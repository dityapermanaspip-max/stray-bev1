import type { Rng } from './rng.ts';

// Every chance roll is out of 1000. Luck adds flat per-mille to good outcomes and takes it from bad ones:
// a 2/1000 rare drop at luck 5 becomes 7/1000, a 500/1000 drop becomes 505/1000. Hidden from the client.

export const PERMILLE = 1000;
export type LuckConfig = { perPoint: number; badFloor: number }; // badFloor: share of the base a bad chance keeps

const clamp = (v: number) => Math.min(PERMILLE, Math.max(0, v));

export function goodChance(cfg: LuckConfig, base: number, luck: number): number {
  return clamp(base + luck * cfg.perPoint);
}

export function badChance(cfg: LuckConfig, base: number, luck: number): number {
  return clamp(Math.max(base * cfg.badFloor, base - luck * cfg.perPoint));
}

// True with chance permille/1000. A whole number 0-999 is rolled, so 1000 always passes and 0 never does.
export function rollPermille(rng: Rng, permille: number): boolean {
  return Math.floor(rng() * PERMILLE) < permille;
}
