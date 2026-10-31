import type { BalanceConfig, Curve } from '../config/balance.ts';

// Exp curves ported from stats.py, coefficients from balance_config.

const evaluate = (c: Curve, level: number) => c.a + c.b * level + (c.c ?? 0) * level * level;

// Move exp needed to go from `level` to `level + 1`.
export const moveExpRequired = (cfg: BalanceConfig, level: number) =>
  evaluate(cfg.curves.moveExpRequired, level);

// Base stat exp paid when a move reaches `moveLevel`.
export const statExpRewardBase = (cfg: BalanceConfig, moveLevel: number) =>
  evaluate(cfg.curves.statExpRewardBase, moveLevel);

// Stat exp needed to raise a stat from `base` to `base + 1`.
export const statExpRequired = (cfg: BalanceConfig, base: number) =>
  evaluate(cfg.curves.statExpRequired, base);

// Word tier for a move level (1 clumsy ... 4 mastered).
export function moveLevelWordTier(cfg: BalanceConfig, level: number): number {
  return cfg.moveLevelWords.filter((start) => level >= start).length;
}
