import type { BossConfig } from '../config/world_config.ts';
import type { Progress } from '../growth/level_up.ts';
import { STATS, type CoreStats } from '../stats/derived.ts';

// Boss rules (pure, all hidden; docs/GAME_DESIGN.md, Boss). Entering takes one key of every type; the keys the
// player carried at that moment weaken the boss for the fight, and each consumed set weakens it for good.

// Keys per type -> weakening: per_key for the first of a type, x duplicate_falloff for each more of it.
export function carriedWeakening(cfg: BossConfig, counts: ReadonlyMap<string, number>): number {
  let w = 0;
  for (const n of counts.values()) for (let i = 0; i < n; i++) w += cfg.perKey * cfg.duplicateFalloff ** i;
  return w;
}

export const totalWeakening = (cfg: BossConfig, carried: number, permanent: number) => Math.min(cfg.maxWeakening, Math.max(0, carried + permanent));

export const hasFullSet = (types: readonly string[], counts: ReadonlyMap<string, number>) => types.every((t) => (counts.get(t) ?? 0) > 0);

// The boss's core stats: boss_total split evenly, leftovers to the first stats.
export function bossStats(total: number): CoreStats {
  const each = Math.floor(total / STATS.length);
  const extra = total - each * STATS.length;
  return Object.fromEntries(STATS.map((s, i) => [s, each + (i < extra ? 1 : 0)])) as CoreStats;
}

// A copy of the boss's progress for one fight, every core stat lowered by the weakening share (never below 1).
export function weakenedProgress(p: Progress, weaken: number): Progress {
  const stats = Object.fromEntries(STATS.map((s) => [s, { ...p.stats[s], base: Math.max(1, Math.round(p.stats[s].base * (1 - weaken))) }])) as Progress['stats'];
  return { stats, moves: new Map(p.moves), recipes: new Set(p.recipes) };
}
