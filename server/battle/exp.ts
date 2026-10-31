import { addMoveExp } from '../growth/level_up.ts';
import { EPIPHANY_PREFIX, learnUnlocks } from '../growth/unlocks.ts';
import { totalStats } from '../stats/derived.ts';
import type { BattleCore } from './core.ts';
import type { BattleEntity } from './types.ts';

// Move exp from use. Growth itself happens only in addMoveExp.

export type UsageOutcome = 'hit' | 'miss' | 'critical' | 'kill';

// Full exp against enemies with at least full_at of your total stats, less below, never under min_mult.
export function enemyExpMult(
  scaling: { full_at: number; min_mult: number },
  enemyTotal: number,
  selfTotal: number,
): number {
  const ratio = enemyTotal / Math.max(1, selfTotal);
  return Math.min(1, Math.max(scaling.min_mult, ratio / scaling.full_at));
}

export function payMoveExp(
  core: BattleCore,
  entity: BattleEntity,
  moveName: string,
  outcome: UsageOutcome,
  opponent: BattleEntity | null,
): void {
  if (!entity.grows) return;
  const progress = core.progress.get(entity.id);
  const move = core.data.moves.get(moveName);
  if (!progress || !move) return;

  const { cfg } = core;
  let amount = cfg.usageExp[outcome];
  if (cfg.enemyScaling.enabled && opponent && opponent.side !== entity.side) {
    amount *= enemyExpMult(cfg.enemyScaling, totalStats(opponent.stats), totalStats(entity.stats));
  }
  if (core.summonerSides.has(entity.side)) amount *= 1 + cfg.summonerExpBonus;

  const growth = addMoveExp(progress, moveName, amount, { statExp: move.statExp, expScaling: move.expScaling, tier: move.tier, tags: move.tags }, cfg);
  for (const event of growth) {
    if (event.kind === 'move_level_up') entity.moveLevels.set(event.move, event.level);
    if (event.kind === 'move_word') core.say(entity, 'move_level', event.tier);
    if (event.kind === 'stat_up') core.say(entity, `level_up.${event.stat}`);
  }
  // Recipes are checked on every move level-up. New moves are known but not equipped.
  if (!growth.some((e) => e.kind === 'move_level_up')) return;
  for (const learned of learnUnlocks(core.data.unlocks, progress)) {
    core.emit({ type: 'learned', entity: entity.id, move: learned.move });
    core.say(entity, EPIPHANY_PREFIX + learned.kind);
  }
}
