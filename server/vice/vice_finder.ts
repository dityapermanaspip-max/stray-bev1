import type pg from 'pg';
import { isFighting, startFighting } from '../util/entity_lock.ts';
import { rollPermille } from '../util/luck.ts';
import type { Rng } from '../util/rng.ts';
import type { Foe } from '../world/encounter.ts';

// Where the living vices stand (hidden): a cache of world.hexes.vice_entity_id for the round being played, filled at
// start and kept in step by kills, births and moves. The DB stays the truth; reload() rebuilds the cache from it.
// Finding a vice is hard: only find_permille of the encounters in its hex are the vice itself, alone.

export type ViceHere = { id: string; type: string };
const here = new Map<string, ViceHere>(); // hex id -> vice

export async function reloadVices(pool: pg.Pool, roundId: string): Promise<void> {
  const rows = (await pool.query<{ hex: string; id: string; type: string }>(
    `SELECT h.id::text AS hex, v.entity_id::text AS id, v.vice_type AS type
     FROM world.hexes h JOIN world.vice_state v ON v.entity_id = h.vice_entity_id
     WHERE h.round_id = $1 AND v.alive`, [roundId],
  )).rows;
  here.clear();
  for (const r of rows) here.set(r.hex, { id: r.id, type: r.type });
}

export const viceIn = (ref: string): ViceHere | null => here.get(ref) ?? null;
export const setViceIn = (ref: string, vice: ViceHere | null) => void (vice ? here.set(ref, vice) : here.delete(ref));

export function forgetVice(id: string): void {
  for (const [ref, v] of here) if (v.id === id) here.delete(ref);
}

// An encounter that rolled in a vice's hex may be the vice instead (never one already in a fight). The vice is
// marked fighting at once; whoever sets up the battle releases it (releaseFoes) when it ends or fails.
export function withVice(ref: string, foes: Foe[] | null, findPermille: number, rng: Rng): Foe[] | null {
  const vice = foes ? viceIn(ref) : null;
  if (!vice || isFighting(vice.id) || !rollPermille(rng, findPermille)) return foes;
  startFighting(vice.id);
  return [{ species: 'vice', corrupted: true, vice }];
}
