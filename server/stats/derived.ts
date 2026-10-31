import type { DerivedConfig } from '../config/balance.ts';

// Port of stats.py calc_derived. Derived stats are computed, never stored.

export const STATS = ['str', 'dex', 'int', 'end', 'luck', 'charm'] as const;
export type Stat = (typeof STATS)[number];
export type CoreStats = Record<Stat, number>;

export type Derived = {
  speed: number;
  accuracy: number;
  maxHp: number;
  maxStamina: number;
  maxMana: number;
  maxInventoryWeight: number;
  critChance: number;
  dodgeChance: number;
};

export function calcDerived(s: CoreStats, d: DerivedConfig): Derived {
  const pair = (a: number, b: number) =>
    Math.min(Math.sqrt(a * b), d.chance.min_pair_mult * Math.min(a, b));
  const accuracy = pair(s.dex, s.int);
  const speed = pair(s.str, s.dex);

  return {
    speed,
    accuracy,
    maxHp: Math.floor(Math.sqrt(s.str * s.end) * d.maxHp.sqrt_str_end + d.maxHp.end * s.end),
    maxStamina: Math.floor(
      Math.sqrt(s.dex * s.end) * d.maxStamina.sqrt_dex_end + d.maxStamina.end * s.end,
    ),
    maxMana: Math.floor(
      Math.sqrt(s.int * s.end) * d.maxMana.sqrt_int_end + d.maxMana.end * s.end + d.maxMana.int * s.int,
    ),
    maxInventoryWeight: Math.floor(s.str * d.maxInventoryWeight.str + d.maxInventoryWeight.base),
    critChance: Math.sqrt(s.luck * accuracy) * d.chance.crit,
    dodgeChance: Math.sqrt(s.luck * speed) * d.chance.dodge,
  };
}

export function totalStats(s: CoreStats): number {
  return STATS.reduce((sum, stat) => sum + s[stat], 0);
}
