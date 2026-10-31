import type { BalanceConfig } from '../config/balance.ts';
import { raceExpMult, tierPoints } from '../config/growth_config.ts';
import { STATS, type CoreStats, type Stat } from '../stats/derived.ts';
import { moveExpRequired, moveLevelWordTier, statExpRequired, statExpRewardBase } from '../stats/curves.ts';

// THE move level-up function. This is the only place stat exp is ever added.

export type StatProgress = { base: number; exp: number };
export type KnownMove = { level: number; exp: number };
export type Progress = {
  stats: Record<Stat, StatProgress>;
  moves: Map<string, KnownMove>;
  recipes: Set<string>; // moves revealed by scrolls (known_recipes)
  race?: string; // for the hidden race move exp rules (config growth.race_exp)
};
// Current core stats of a growing entity.
export function progressStats(progress: Progress): CoreStats {
  return Object.fromEntries(STATS.map((s) => [s, progress.stats[s].base])) as CoreStats;
}

// statExp: the move's stat shares (how its points split); tier: from the move's `tier:N` tag; tags for race rules.
export type MoveGrowth = { statExp: Partial<Record<Stat, number>>; expScaling: number; tier: number; tags: string[] };

// Server-side results. Numbers here never go to the client as-is.
export type GrowthEvent =
  | { kind: 'move_level_up'; move: string; level: number }
  | { kind: 'move_word'; move: string; tier: number }
  | { kind: 'stat_up'; stat: Stat };

export function addMoveExp(
  progress: Progress,
  moveName: string,
  amount: number,
  growth: MoveGrowth,
  cfg: BalanceConfig,
): GrowthEvent[] {
  const known = progress.moves.get(moveName);
  if (!known || amount <= 0 || known.level >= cfg.moveLevelCap) return [];

  const events: GrowthEvent[] = [];
  const wordBefore = moveLevelWordTier(cfg, known.level);
  known.exp += amount * raceExpMult(cfg.statGrowth, progress.race, growth.tags, known.level);
  const shares = Object.values(growth.statExp).reduce((n, v) => n + (v ?? 0), 0);

  while (known.level < cfg.moveLevelCap && known.exp >= moveExpRequired(cfg, known.level)) {
    known.exp -= moveExpRequired(cfg, known.level);
    known.level += 1;
    events.push({ kind: 'move_level_up', move: moveName, level: known.level });

    // Stat exp per point x the points this tier pays at this level, split by the move's stat shares.
    const reward = statExpRewardBase(cfg, known.level) * tierPoints(cfg.statGrowth, growth.tier, known.level) * growth.expScaling;
    for (const stat of STATS) {
      const share = growth.statExp[stat];
      if (share && shares > 0) progress.stats[stat].exp += (reward * share) / shares;
    }
  }
  if (known.level >= cfg.moveLevelCap) known.exp = 0;

  const wordAfter = moveLevelWordTier(cfg, known.level);
  if (wordAfter !== wordBefore) events.push({ kind: 'move_word', move: moveName, tier: wordAfter });

  for (const stat of STATS) {
    const sp = progress.stats[stat];
    while (sp.exp >= statExpRequired(cfg, sp.base)) {
      sp.exp -= statExpRequired(cfg, sp.base);
      sp.base += 1;
      events.push({ kind: 'stat_up', stat });
    }
  }
  return events;
}
