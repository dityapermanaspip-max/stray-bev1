import type pg from 'pg';
import type { BalanceConfig } from '../config/balance.ts';
import { startCounts } from '../config/world_config.ts';
import type { CoreStats } from '../stats/derived.ts';
import type { Rng } from '../util/rng.ts';
import { placeVice } from '../vice/vice_repo.ts';
import { cultureFor, loadCultures } from './cultures.ts';
import { shuffle, type WorldPlan } from './plan.ts';

// Writes a planned world as a new round, in one transaction. Earlier rounds of the same status end.
// Hexes get the species of their biome (world.biome_species): hex_max split by weight, start counts by
// world.rings.start; the ring only decides how strong they are when met. A hex that holds a town (its wild land
// around the town gate) starts with natives only. The boss hex (ring 0) holds no regular creatures.
// Each town is its own field (world.towns, own seed) with an economy row from world.gen.town. Its culture (the one
// that settles in its biome, else the first) gives the field template, more specialties, the taboo and job shares.
// The 6 starting vices go to wild hexes of vice_rings.

export type BiomeSpecies = Map<string, { id: string; weight: number; bornCorrupted?: boolean }[]>; // biome -> species ids and weights
export const TEMPLATES = { open: 'open_field', town: 'town_square', corridor: 'corridor_path' };

export async function writeWorld(
  client: pg.PoolClient, cfg: BalanceConfig, plan: WorldPlan, seed: number, species: BiomeSpecies, rng: Rng, status: 'active' | 'dev' = 'active',
): Promise<string> {
  const g = cfg.worldGen;
  await client.query("UPDATE world.rounds SET status = 'ended', ended_at = now() WHERE status = $1", [status]);
  const roundId = (await client.query<{ id: string }>('INSERT INTO world.rounds (status, seed, tick_at) VALUES ($1, $2, now()) RETURNING id', [status, seed])).rows[0].id;

  const h = plan.hexes;
  const ids = (await client.query<{ id: string }>(
    `INSERT INTO world.hexes (round_id, q, r, ring, field_kind, field_template, field_seed, biome)
     SELECT $1, x.q, x.r, x.ring, x.kind, x.template, x.seed, x.biome
     FROM unnest($2::int[], $3::int[], $4::int[], $5::text[], $6::text[], $7::bigint[], $8::text[]) WITH ORDINALITY AS x(q, r, ring, kind, template, seed, biome, n)
     ORDER BY x.n RETURNING id::text`,
    [roundId, h.map((x) => x.q), h.map((x) => x.r), h.map((x) => x.ring), h.map((x) => (x.town ? 'town' : 'open')),
      h.map(() => TEMPLATES.open), h.map((x) => x.seed), h.map((x) => x.biome)],
  )).rows.map((r) => r.id);

  const b = plan.borders;
  const borderIds = (await client.query<{ id: string }>(
    `INSERT INTO world.borders (round_id, hex_a, hex_b, corridor_count)
     SELECT $1, x.a, x.b, x.n FROM unnest($2::uuid[], $3::uuid[], $4::int[]) WITH ORDINALITY AS x(a, b, n, i) ORDER BY x.i RETURNING id::text`,
    [roundId, b.map((x) => ids[x.a]), b.map((x) => ids[x.b]), b.map((x) => x.corridors.length)],
  )).rows.map((r) => r.id);
  const corridors = b.flatMap((x, i) => x.corridors.map((s, p) => ({ border: borderIds[i], position: p + 1, seed: s })));
  await client.query(
    `INSERT INTO world.corridors (border_id, position, template, seed) SELECT x.b, x.p, $4, x.s FROM unnest($1::uuid[], $2::int[], $3::bigint[]) AS x(b, p, s)`,
    [corridors.map((c) => c.border), corridors.map((c) => c.position), corridors.map((c) => c.seed), TEMPLATES.corridor],
  );

  const pop: { ref: string; species: string; natives: number; corrupted: number; safe: number; max: number }[] = [];
  h.forEach((x, i) => {
    if (x.ring === 0) return;
    const living = species.get(x.biome) ?? [];
    const weights = living.reduce((n, s) => n + s.weight, 0);
    for (const s of living) {
      const max = Math.floor((g.hexMax * s.weight) / weights);
      const start = startCounts(cfg.rings, max, rng, s.bornCorrupted);
      pop.push({ ref: ids[i], species: s.id, natives: start.natives, corrupted: x.town ? 0 : start.corrupted, safe: Math.round(max * g.safeShare), max });
    }
  });
  await client.query(
    `INSERT INTO world.field_population (field_ref, species_id, natural_count, corrupted_count, safe_count, max_count)
     SELECT * FROM unnest($1::text[], $2::uuid[], $3::int[], $4::int[], $5::int[], $6::int[])`,
    [pop.map((p) => p.ref), pop.map((p) => p.species), pop.map((p) => p.natives), pop.map((p) => p.corrupted), pop.map((p) => p.safe), pop.map((p) => p.max)],
  );

  const towns = h.map((x, i) => ({ ...x, id: ids[i] })).filter((x) => x.town);
  const cultures = await loadCultures(client);
  for (const t of towns) {
    const people = g.town.population.get(t.ring) ?? 0;
    const c = cultureFor(cultures, t.biome);
    const townId = (await client.query<{ id: string }>(
      'INSERT INTO world.towns (round_id, hex_id, template, seed, culture) VALUES ($1, $2, $3, $4, $5) RETURNING id::text',
      [roundId, t.id, c?.townTemplate ?? TEMPLATES.town, Math.floor(rng() * 2 ** 31), c?.name ?? null],
    )).rows[0].id;
    const specialties = [...new Set([...(g.town.specialties[t.biome] ?? []), ...(c?.specialties ?? [])])];
    await client.query(
      `INSERT INTO world.town_economy (town_ref, purse, max_buy, specialties, population, jobs, taboo) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [townId, people * g.town.pursePerPerson, g.town.maxBuy.get(t.ring) ?? 0, specialties, people, JSON.stringify(c?.jobs ?? g.town.jobs), c?.taboo ?? []],
    );
  }

  const wild = h.map((x, i) => ({ id: ids[i], q: x.q, r: x.r, ring: x.ring, town: x.town, hasVice: false })).filter((x) => !x.town && x.ring > 0);
  const spots = g.viceRings.flatMap((ring) => shuffle(wild.filter((x) => x.ring === ring), rng));
  for (const [n, type] of cfg.vice.types.entries()) {
    const hex = spots[n];
    if (!hex) break;
    await placeVice(client, cfg, roundId, type as keyof CoreStats, hex, rng);
  }
  return roundId;
}
