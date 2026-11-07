import type { Rng } from '../util/rng.ts';

// Running away (config `combat.flee`, hidden numbers). One roll for the whole party, made when the player's gauge is full.
// Speed: the slowest standing party member against the fastest standing enemy decides the base chance (equal speeds give
// `base`; `speed_slope` is how far a speed ratio above or below 1 moves it). Luck: the best standing party luck against
// the best standing enemy luck moves it by `luck_slope` the same way. The chance stays between `floor` and `cap`.
export type FleeConfig = { base: number; speed_slope: number; luck_slope: number; floor: number; cap: number };
export type Runner = { speed: number; luck: number };

const ratio = (mine: number, theirs: number) => (mine + 1) / (theirs + 1); // +1: a zero stat never divides by zero

export function fleeChance(cfg: FleeConfig, party: Runner[], enemies: Runner[]): number {
  if (party.length === 0 || enemies.length === 0) return cfg.cap;
  const slowest = Math.min(...party.map((r) => r.speed));
  const fastest = Math.max(...enemies.map((r) => r.speed));
  const luckiest = Math.max(...party.map((r) => r.luck));
  const luckiestFoe = Math.max(...enemies.map((r) => r.luck));
  const chance = cfg.base + cfg.speed_slope * (ratio(slowest, fastest) - 1) + cfg.luck_slope * (ratio(luckiest, luckiestFoe) - 1);
  return Math.min(cfg.cap, Math.max(cfg.floor, chance));
}

export const fleeRoll = (cfg: FleeConfig, party: Runner[], enemies: Runner[], rng: Rng) => rng() < fleeChance(cfg, party, enemies);
