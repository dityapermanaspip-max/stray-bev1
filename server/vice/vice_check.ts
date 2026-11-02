import type pg from 'pg';
import { findViceProblems, viceConfig } from '../config/world_config.ts';
import { VICE_NAME_PREFIX } from '../db/startup_check.ts';

// Startup check for vices: config moves exist, the vice race exists, and every line a vice fight says is there.

export const VICE_NAME = VICE_NAME_PREFIX; // + type: what a player calls a vice of that type
export const VICE_LINE_KEYS = ['field.encounter.vice', 'vice.fell', 'key.gained'];

export async function findViceDataProblems(pool: pg.Pool, raw: unknown, moves: ReadonlySet<string>, lineKeys: ReadonlySet<string>): Promise<string[]> {
  if (!raw) return ['balance_config vice is missing'];
  const vice = viceConfig(raw as Parameters<typeof viceConfig>[0]);
  const race = await pool.query('SELECT 1 FROM entity.races WHERE race_name = $1', [vice.race]);
  return [
    ...findViceProblems(vice, moves),
    ...(race.rowCount ? [] : [`vice race ${vice.race}: unknown`]),
    ...[...VICE_LINE_KEYS, ...vice.types.map((t) => VICE_NAME + t)].filter((k) => !lineKeys.has(k)).map((k) => `${k}: no lines`),
  ];
}
