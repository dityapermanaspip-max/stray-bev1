import type { BalanceConfig, CombatConfig, GrowthRates } from '../config/balance.ts';
import type { CoreStats } from '../stats/derived.ts';
import type { MoveDef } from './types.ts';

// Pure combat math (MOVES.md "Combat math"). All constants come from config.

export type ScaledRates = { damage: number; recovery: number; cost: number };

export function growthRates(cfg: BalanceConfig, move: MoveDef): ScaledRates {
  const tag: GrowthRates | undefined = cfg.growth.get(move.growthTag);
  if (!tag) throw new Error(`move ${move.name}: unknown growth tag ${move.growthTag}`);
  return {
    damage: move.overrides.damage ?? tag.damage_per_level,
    recovery: move.overrides.recovery ?? tag.recovery_per_level,
    cost: move.overrides.cost ?? tag.cost_per_level,
  };
}

export const levelMult = (ratePerLevel: number, level: number) => 1 + ratePerLevel * (level - 1);

export const statMult = (c: CombatConfig, attackStat: number) =>
  c.statMult.base + attackStat / c.statMult.divisor;

export const defenseReduction = (c: CombatConfig, defense: number) =>
  defense <= 0 ? 0 : defense / (defense + c.defenseConstant);

// Chance to connect before the target dodges.
export const hitBase = (c: CombatConfig, moveAccuracy: number, accuracy: number) =>
  Math.min(1, moveAccuracy * (c.hitChance.base + accuracy / c.hitChance.divisor));

export function hitChance(c: CombatConfig, moveAccuracy: number, accuracy: number, dodge: number): number {
  return hitBase(c, moveAccuracy, accuracy) * (1 - Math.min(dodge, c.dodgeCap));
}

// A uniform roll pulled toward the top of a [min, max] range by luck. null when range is not a pair.
export function luckRange(range: unknown, roll: number, luck: number, skew: number): number | null {
  if (!Array.isArray(range) || range.length !== 2) return null;
  const [min, max] = range.map(Number);
  return min + (max - min) * roll ** (1 / (1 + Math.max(0, luck) * Math.max(0, skew)));
}

// Unarmed and melee use str, ranged uses dex, magic uses int.
export function attackStat(move: MoveDef, stats: CoreStats): number {
  if (move.damageKind === 'magic') return stats.int;
  if (move.tags.includes('ranged')) return stats.dex;
  return stats.str;
}

export type DamageInput = {
  power: number;
  weaponPower: number;
  ammoPower: number;
  typeBonus: number;
  levelMult: number;
  statMult: number;
  resistType: number;
  resistElement: number;
  defenseReduction: number;
};

export function baseDamage(d: DamageInput): number {
  return (
    (d.power + d.weaponPower + d.ammoPower) *
    d.typeBonus *
    d.levelMult *
    d.statMult *
    d.resistType *
    d.resistElement *
    (1 - d.defenseReduction)
  );
}

// A landed hit always deals at least minDamage unless the target is immune (mult 0).
export function finalDamage(c: CombatConfig, raw: number, crit: boolean, immune: boolean): number {
  if (immune) return 0;
  const value = Math.round(crit ? raw * c.critMult : raw);
  return Math.max(c.minDamage, value);
}
