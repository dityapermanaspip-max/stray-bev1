import type pg from 'pg';
import type { BalanceConfig } from '../config/balance.ts';
import type { CoreStats } from '../stats/derived.ts';
import type { Rng } from '../util/rng.ts';
import { firesAt } from '../world/clock.ts';
import type { PopRow } from '../world/population.ts';
import { planInvasions, type Invasion, type InvasionHex } from './invasion.ts';
import { placeVice } from './vice_repo.ts';

// Invasions in the world hour's transaction (rules in invasion.ts). The counts are the hour's locked rows: invaders
// leave the source rows and join the target's (a species new there gets its row here). The vice moves, a new vice
// of a random type is born behind it, and each invasion is kept in world.invasions (settled at once; strongholds and
// their attrition war come with kingdoms).

type Row = PopRow & { id?: string };

export async function runInvasions(
  client: pg.PoolClient, cfg: BalanceConfig, roundId: string, hour: number, pop: Map<string, Row[]>, rng: Rng,
): Promise<Invasion[]> {
  if (firesAt(cfg.ticks.invasion.intervalHours, hour) === 0) return [];
  const rows = (await client.query<InvasionHex & { vice: string | null }>(
    `SELECT id::text AS id, q, r, ring, field_kind = 'town' AS town, vice_entity_id::text AS vice FROM world.hexes WHERE round_id = $1`, [roundId],
  )).rows;
  const vices = new Map(rows.filter((h) => h.vice).map((h) => [h.id, h.vice!]));
  const done = planInvasions(cfg.ticks.invasion, rows, pop as Map<string, PopRow[]>, vices, rng);
  const byId = new Map(rows.map((h) => [h.id, h]));
  for (const inv of done) {
    const from = byId.get(inv.from)!;
    const to = byId.get(inv.to)!;
    for (const r of pop.get(inv.to) ?? []) {
      if (r.id) continue;
      r.id = (await client.query<{ id: string }>(
        `INSERT INTO world.field_population (field_ref, species_id, natural_count, corrupted_count, safe_count, max_count)
         SELECT $1, s.id, 0, $3, 0, 0 FROM entity.species s WHERE s.species_name = $2 RETURNING id`, [inv.to, r.species, r.corrupted],
      )).rows[0]?.id;
    }
    await client.query('UPDATE world.hexes SET vice_entity_id = NULL WHERE id = $1', [inv.from]);
    await client.query('UPDATE world.hexes SET vice_entity_id = $2 WHERE id = $1', [inv.to, inv.viceId]);
    await client.query('UPDATE world.vice_state SET hex_q = $2, hex_r = $3 WHERE entity_id = $1', [inv.viceId, to.q, to.r]);
    await client.query('UPDATE entity.entities SET location_ref = $2 WHERE id = $1', [inv.viceId, inv.to]);
    const type = cfg.vice.types[Math.floor(rng() * cfg.vice.types.length)] as keyof CoreStats;
    await placeVice(client, cfg, roundId, type, { ...from, hasVice: false }, rng, 'invasion');
    await client.query(
      `INSERT INTO world.invasions (round_id, vice_entity_id, from_hex, to_hex, invader_count, status, world_hour) VALUES ($1, $2, $3, $4, $5, 'settled', $6)`,
      [roundId, inv.viceId, inv.from, inv.to, [...inv.invaders.values()].reduce((n, x) => n + x, 0), hour],
    );
  }
  return done;
}
