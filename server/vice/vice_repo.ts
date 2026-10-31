import type pg from 'pg';
import type { BalanceConfig } from '../config/balance.ts';
import { inTransaction } from '../data/entity_save.ts';
import { addFame } from '../standing/standing_repo.ts';
import type { CoreStats } from '../stats/derived.ts';
import type { Rng } from '../util/rng.ts';
import type { PopRow } from '../world/population.ts';
import { birthHex, viceStats, type BirthHex } from './rebirth.ts';

// Vices in the DB (hidden). A vice is a named entity with its stats, a vice_state row, and its hex's vice_entity_id.
// Its moves, battles and lines come with the vice fight step.

type Db = pg.PoolClient;

// Places a new vice of a type in a hex: entity, stats, vice_state, the hex's vice. Answers the entity id.
export async function placeVice(client: Db, roundId: string, type: keyof CoreStats, hex: BirthHex, stats: CoreStats): Promise<string> {
  const res = await client.query<{ id: string }>(
    `INSERT INTO entity.entities (kind, name, round_id, location_ref) VALUES ('named', $1, $2, $3) RETURNING id`,
    [`vice_${type}`, roundId, hex.id],
  );
  const id = res.rows[0].id;
  const entries = Object.entries(stats);
  await client.query(
    `INSERT INTO entity.entity_stats (entity_id, stat, base) SELECT $1, x.stat, x.base FROM unnest($2::text[], $3::numeric[]) AS x(stat, base)`,
    [id, entries.map(([s]) => s), entries.map(([, v]) => v)],
  );
  await client.query('INSERT INTO world.vice_state (round_id, vice_type, entity_id, hex_q, hex_r) VALUES ($1, $2, $3, $4, $5)', [roundId, type, id, hex.q, hex.r]);
  await client.query('UPDATE world.hexes SET vice_entity_id = $2 WHERE id = $1', [hex.id, id]);
  return id;
}

// The round's hexes as birth candidates, with each hex's summed counts as one row.
async function candidates(client: Db, roundId: string): Promise<{ hexes: BirthHex[]; pop: Map<string, PopRow[]> }> {
  const res = await client.query<{ id: string; q: number; r: number; ring: number; town: boolean; has_vice: boolean; natives: string; corrupted: string }>(
    `SELECT h.id::text, h.q, h.r, h.ring, h.field_kind = 'town' AS town, h.vice_entity_id IS NOT NULL AS has_vice,
            coalesce(sum(p.natural_count), 0) AS natives, coalesce(sum(p.corrupted_count), 0) AS corrupted
     FROM world.hexes h LEFT JOIN world.field_population p ON p.field_ref = h.id::text
     WHERE h.round_id = $1 GROUP BY h.id ORDER BY h.q, h.r`, [roundId],
  );
  return {
    hexes: res.rows.map((h) => ({ id: h.id, q: h.q, r: h.r, ring: h.ring, town: h.town, hasVice: h.has_vice })),
    pop: new Map(res.rows.map((h) => [h.id, [{ species: 'all', natives: Number(h.natives), corrupted: Number(h.corrupted), safe: 0, max: 0 }]])),
  };
}

export type ViceDeath = { type: string; reborn: { entityId: string; hexId: string } | null };

// A vice is killed (one transaction): it dies for good, its hex is freed, the killer gets its type's key (always),
// and if it was the last of its type alive, a new vice of that type is born at once (null when no wild hex is free).
export async function killVice(pool: pg.Pool, cfg: BalanceConfig, roundId: string, viceId: string, killerId: string, rng: Rng): Promise<ViceDeath> {
  return inTransaction(pool, async (client) => {
    const rows = (await client.query<{ entity_id: string; vice_type: string; alive: boolean; hex_q: number; hex_r: number }>(
      'SELECT entity_id::text, vice_type, alive, hex_q, hex_r FROM world.vice_state WHERE round_id = $1 ORDER BY id FOR UPDATE', [roundId],
    )).rows;
    const dead = rows.find((r) => r.entity_id === viceId);
    if (!dead?.alive) throw new Error(`no living vice ${viceId}`);
    await client.query('UPDATE world.vice_state SET alive = false WHERE entity_id = $1', [viceId]);
    await client.query('UPDATE entity.entities SET alive = false, died_at = now() WHERE id = $1', [viceId]);
    await client.query('UPDATE world.hexes SET vice_entity_id = NULL WHERE vice_entity_id = $1', [viceId]);
    await client.query("INSERT INTO item.keys (round_id, vice_type, holder_entity_id, source) VALUES ($1, $2, $3, 'vice_kill')", [roundId, dead.vice_type, killerId]);
    // Word spreads from where it fell: fame in the towns nearby.
    await addFame(client, cfg.standing, roundId, killerId, { q: dead.hex_q, r: dead.hex_r }, cfg.standing.fame.viceKill);
    if (rows.some((r) => r.alive && r.vice_type === dead.vice_type && r.entity_id !== viceId)) return { type: dead.vice_type, reborn: null };
    const { hexes, pop } = await candidates(client, roundId);
    const hex = birthHex(hexes, pop, rng);
    if (!hex) return { type: dead.vice_type, reborn: null };
    const type = dead.vice_type as keyof CoreStats;
    const entityId = await placeVice(client, roundId, type, hex, viceStats(cfg.vice, cfg.rings, type, hex.ring));
    return { type: dead.vice_type, reborn: { entityId, hexId: hex.id } };
  });
}
