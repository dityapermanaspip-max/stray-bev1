import type { BalanceConfig, BodyResource } from '../config/balance.ts';
import type { Stat } from '../stats/derived.ts';
import { growthRates, levelMult } from './damage.ts';
import type { BattleEntity, MoveDef } from './types.ts';

// Move requirements, costs, targeting rules, and body-state tiers.

export const isAlive = (e: BattleEntity) => e.phase !== 'downed';

export function meetsRequirements(e: BattleEntity, move: MoveDef): boolean {
  return move.requires.every((r) => {
    switch (r.kind) {
      case 'body_part':
        return e.bodyParts.includes(r.value) && !e.effects.some((f) => f.kind === 'disable_part' && f.part === r.value);
      case 'weapon_type':
        return e.weaponType === r.value;
      case 'ammo_type':
        return (e.ammo.get(r.value) ?? 0) > 0;
      case 'stat_min':
        return e.stats[r.value as Stat] >= (r.amount ?? 0);
      default:
        return false; // affinity and unknown kinds: not usable until implemented
    }
  });
}

export function moveCost(cfg: BalanceConfig, move: MoveDef, level: number): number {
  return Math.max(0, move.cost * levelMult(growthRates(cfg, move).cost, level));
}

// What this entity pays for a move: a meal's hidden cost multipliers apply (food). Magic's stamina share uses the
// stamina multiplier.
export function entityCost(cfg: BalanceConfig, e: BattleEntity, move: MoveDef): { cost: number; staminaShare: number } {
  const cost = moveCost(cfg, move, e.moveLevels.get(move.name) ?? 1) * (move.resource ? e.costMult?.[move.resource] ?? 1 : 1);
  return { cost, staminaShare: move.resource === 'mana' ? magicStaminaCost(cfg, cost) * (e.costMult?.stamina ?? 1) : 0 };
}

export function canUse(cfg: BalanceConfig, e: BattleEntity, move: MoveDef): boolean {
  if (move.category === 'life') return false;
  if (!e.moves.includes(move.name) || !meetsRequirements(e, move)) return false;
  if ((e.cooldowns.get(move.name) ?? 0) > 0) return false;
  if (move.resource === 'mana' && e.effects.some((f) => f.kind === 'silence')) return false;
  const { cost, staminaShare } = entityCost(cfg, e, move);
  if (move.resource === 'stamina' && e.stamina < cost) return false;
  if (move.resource === 'mana' && (e.mana < cost || e.stamina < staminaShare)) return false;
  return true;
}

// Magic also costs a small share of its mana cost as stamina.
export function magicStaminaCost(cfg: BalanceConfig, manaCost: number): number {
  return manaCost * cfg.combat.magicStaminaShare;
}

// Entities a move may target. Melee ('front') hits the front row,
// or the back row only when the front row is empty.
export function validTargets(all: BattleEntity[], actor: BattleEntity, move: MoveDef): BattleEntity[] {
  const alive = all.filter(isAlive);
  const allies = alive.filter((e) => e.side === actor.side);
  const enemies = alive.filter((e) => e.side !== actor.side);
  const reachable = (list: BattleEntity[]) => {
    if (move.rowRule !== 'front') return list;
    const front = list.filter((e) => e.row === 'front');
    return front.length > 0 ? front : list;
  };

  switch (move.target) {
    case 'self':
      return [actor];
    case 'one_ally':
    case 'all_allies':
      return allies;
    case 'one_enemy':
    case 'enemy_row':
    case 'all_enemies':
      return reachable(enemies);
  }
}

// Expands the chosen target into everyone the move hits.
export function expandTargets(all: BattleEntity[], actor: BattleEntity, move: MoveDef, chosen: BattleEntity): BattleEntity[] {
  const valid = validTargets(all, actor, move);
  switch (move.target) {
    case 'all_allies':
    case 'all_enemies':
      return valid;
    case 'enemy_row':
      return valid.filter((e) => e.row === chosen.row);
    default:
      return valid.includes(chosen) ? [chosen] : [];
  }
}

export function bodyTier(cfg: BalanceConfig, resource: BodyResource, current: number, max: number): number {
  const frac = max <= 0 ? 0 : Math.max(0, current) / max;
  return Math.max(1, cfg.bodyTiers[resource].filter((start) => frac >= start).length);
}
