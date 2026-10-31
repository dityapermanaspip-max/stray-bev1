import type pg from 'pg';
import type { BalanceConfig } from '../config/balance.ts';
import { startCounts } from '../config/world_config.ts';
import type { CoreStats } from '../stats/derived.ts';
import type { Rng } from '../util/rng.ts';
import { placeVice } from '../vice/vice_repo.ts';
import { viceStats } from '../vice/rebirth.ts';
import { shuffle, type WorldPlan } from './plan.ts';

// Writes a planned world as a new active round, in one transaction. Earlier active rounds end.
// Wild hexes get every species of their ring: max = hex_max split over them, start counts by world.rings.start.
// Town hexes (their wild edge) start with natives only. The boss hex holds no regular creatures.
// Each town gets an economy row from world.gen.town. The 6 starting vices go to wild hexes of vice_rings.

export type SpeciesRing = { id: string; ringMin: number; ringMax: number };
export const TEMPLATES = { open: 'open_field', town: 'town_square', corridor: 'corridor_path' };

export async function writeWorld(client: pg.PoolClient, cfg: BalanceConfig, plan: WorldPlan, seed: number, species: SpeciesRing[], rng: Rng): Promise<string> {
  const g = cfg.worldGen;
  await client.query("UPDATE world.rounds SET status = 'ended', ended_at = now() WHERE status = 'active'");
  const roundId = (await client.query<{ id: string }>("INSERT INTO world.rounds (status, seed, tick_at) VALUES ('active', $1, now()) RETURNING id", [seed])).rows[0].id;

  const h = plan.hexes;
  const ids = (await client.query<{ id: string }>(
    `INSERT INTO world.hexes (round_id, q, r, ring, field_kind, field_template, field_seed, biome)
     SELECT $1, x.q, x.r, x.ring, x.kind, x.template, x.seed, x.biome
     FROM unnest($2::int[], $3::int[], $4::int[], $5::text[], $6::text[], $7::bigint[], $8::text[]) WITH ORDINALITY AS x(q, r, ring, kind, template, seed, biome, n)
     ORDER BY x.n RETURNING id::text`,
    [roundId, h.map((x) => x.q), h.map((x) => x.r), h.map((x) => x.ring), h.map((x) => (x.town ? 'town' : 'open')),
      h.map((x) => (x.town ? TEMPLATES.town : TEMPLATES.open)), h.map((x) => x.seed), h.map((x) => x.biome)],
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
    const living = species.filter((s) => s.ringMin <= x.ring && x.ring <= s.ringMax);
    for (const s of living) {
      const max = Math.floor(g.hexMax / living.length);
      const start = startCounts(cfg.rings, max, rng);
      pop.push({ ref: ids[i], species: s.id, natives: start.natives, corrupted: x.town ? 0 : start.corrupted, safe: Math.round(max * g.safeShare), max });
    }
  });
  await client.query(
    `INSERT INTO world.field_population (field_ref, species_id, natural_count, corrupted_count, safe_count, max_count)
     SELECT * FROM unnest($1::text[], $2::uuid[], $3::int[], $4::int[], $5::int[], $6::int[])`,
    [pop.map((p) => p.ref), pop.map((p) => p.species), pop.map((p) => p.natives), pop.map((p) => p.corrupted), pop.map((p) => p.safe), pop.map((p) => p.max)],
  );

  const towns = h.map((x, i) => ({ ...x, id: ids[i] })).filter((x) => x.town);
  for (const t of towns) {
    const people = g.town.population.get(t.ring) ?? 0;
    await client.query(
      `INSERT INTO world.town_economy (town_ref, purse, max_buy, specialties, population, jobs) VALUES ($1, $2, $3, $4, $5, $6)`,
      [t.id, people * g.town.pursePerPerson, g.town.maxBuy.get(t.ring) ?? 0, g.town.specialties[t.biome] ?? [], people, JSON.stringify(g.town.jobs)],
    );
  }

  const wild = h.map((x, i) => ({ id: ids[i], q: x.q, r: x.r, ring: x.ring, town: x.town, hasVice: false })).filter((x) => !x.town && x.ring > 0);
  const spots = g.viceRings.flatMap((ring) => shuffle(wild.filter((x) => x.ring === ring), rng));
  for (const [n, type] of cfg.vice.types.entries()) {
    const hex = spots[n];
    if (!hex) break;
    await placeVice(client, roundId, type as keyof CoreStats, hex, viceStats(cfg.vice, cfg.rings, type as keyof CoreStats, hex.ring));
  }
  return roundId;
}
