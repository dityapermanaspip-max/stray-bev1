import type pg from 'pg';
import { bossConfig } from '../config/world_config.ts';
import { BOSS_NAME } from '../db/startup_check.ts';

// Startup check for the boss: config moves exist, its race exists, its name and the chamber lines are there.

export const BOSS_LINE_KEYS = ['boss.sealed', 'boss.enter', 'boss.fell'];

export async function findBossProblems(pool: pg.Pool, config: Map<string, unknown>, moves: ReadonlySet<string>, lineKeys: ReadonlySet<string>): Promise<string[]> {
  if (!config.has('boss') || !config.has('key_weakening') || !config.has('boss_set_weakening')) return ['balance_config boss, key_weakening or boss_set_weakening is missing'];
  const boss = bossConfig(config.get('boss') as Parameters<typeof bossConfig>[0], config.get('key_weakening') as Parameters<typeof bossConfig>[1], Number(config.get('boss_set_weakening')));
  const race = await pool.query('SELECT 1 FROM entity.races WHERE race_name = $1', [boss.race]);
  return [
    ...(boss.moves.length ? [] : ['boss: no moves']),
    ...boss.moves.filter((m) => !moves.has(m)).map((m) => `boss: unknown move ${m}`),
    ...(race.rowCount ? [] : [`boss race ${boss.race}: unknown`]),
    ...[...BOSS_LINE_KEYS, BOSS_NAME].filter((k) => !lineKeys.has(k)).map((k) => `${k}: no lines`),
  ];
}
