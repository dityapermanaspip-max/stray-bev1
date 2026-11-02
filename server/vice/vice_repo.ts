import type pg from 'pg';
import type { BalanceConfig } from '../config/balance.ts';
import { inTransaction, writeLoadout, writeProgress } from '../data/entity_save.ts';
import type { Progress } from '../growth/level_up.ts';
import { addFame } from '../standing/standing_repo.ts';
import { STATS, type CoreStats } from '../stats/derived.ts';
import type { Rng } from '../util/rng.ts';
import type { PopRow } from '../world/population.ts';
import { birthHex, viceStats, type BirthHex } from './rebirth.ts';
import { rollViceMoves } from './vice_moves.ts';

// Vices in the DB (hidden). A vice is a named entity of the vice race with its stats, rolled moves (best ones
// equipped), a vice_state row, and its hex's vice_entity_id. It grows like a player once born.

type Db = pg.PoolClient;

// Places a new vice of a type in a hex: entity, stats, moves, loadout, vice_state, the hex's vice. Answers the entity id.
export type ViceBirth = 'start' | 'rebirth' | 'invasion';

export async function placeVice(
  client: Db, cfg: BalanceConfig, roundId: string, type: keyof CoreStats, hex: BirthHex, rng: Rng, born: ViceBirth = 'start',
): Promise<string> {
  const res = await client.query<{ id: string }>(
    `INSERT INTO entity.entities (kind, name, race_id, round_id, location_ref)
     SELECT 'named', $1, r.id, $2, $3 FROM entity.races r WHERE r.race_name = $4 RETURNING id`,
    [`vice_${type}`, roundId, hex.id, cfg.vice.race],
  );
  if (!res.rows[0]) throw new Error(`vice race ${cfg.vice.race} unknown`);
  const id = res.rows[0].id;
  const stats = viceStats(cfg.vice, cfg.rings, type, hex.ring);
  const moves = rollViceMoves(cfg, type, hex.ring, rng);
  const progress: Progress = {
    stats: Object.fromEntries(STATS.map((s) => [s, { base: stats[s], exp: 0 }])) as Progress['stats'],
    moves: new Map(moves.map((m) => [m.name, { level: m.level, exp: 0 }])),
    recipes: new Set(),
  };
  await writeProgress(client, id, progress, true);
  await writeLoadout(client, id, new Map(moves.filter((m) => m.equipped).map((m, i) => [i + 1, m.name])));
  await client.query(
    'INSERT INTO world.vice_state (round_id, vice_type, entity_id, hex_q, hex_r, born) VALUES ($1, $2, $3, $4, $5, $6)', [roundId, type, id, hex.q, hex.r, born],
  );
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
    const entityId = await placeVice(client, cfg, roundId, dead.vice_type as keyof CoreStats, hex, rng, 'rebirth');
    return { type: dead.vice_type, reborn: { entityId, hexId: hex.id } };
  });
}

// Vices placed before vices had moves get them once (at game server start): rolled for their hex's ring, best equipped.
export async function fillMovelessVices(pool: pg.Pool, cfg: BalanceConfig, roundId: string, rng: Rng): Promise<number> {
  const rows = (await pool.query<{ id: string; type: string; ring: number }>(
    `SELECT v.entity_id::text AS id, v.vice_type AS type, h.ring
     FROM world.vice_state v JOIN world.hexes h ON h.vice_entity_id = v.entity_id
     WHERE v.round_id = $1 AND v.alive AND NOT EXISTS (SELECT 1 FROM entity.known_moves k WHERE k.entity_id = v.entity_id)`, [roundId],
  )).rows;
  for (const r of rows) {
    const moves = rollViceMoves(cfg, r.type as keyof CoreStats, r.ring, rng);
    await inTransaction(pool, async (client) => {
      await client.query('UPDATE entity.entities SET race_id = (SELECT id FROM entity.races WHERE race_name = $2) WHERE id = $1', [r.id, cfg.vice.race]);
      await client.query(
        `INSERT INTO entity.known_moves (entity_id, move_id, level, exp, seen)
         SELECT $1, m.id, x.level, 0, true FROM unnest($2::text[], $3::int[]) AS x(name, level) JOIN moves.moves m ON m.move_name = x.name`,
        [r.id, moves.map((m) => m.name), moves.map((m) => m.level)],
      );
      await writeLoadout(client, r.id, new Map(moves.filter((m) => m.equipped).map((m, i) => [i + 1, m.name])));
    });
  }
  return rows.length;
}
