import type { LadderConfig } from '../config/standing_config.ts';

// Companion rules (pure, hidden): which favor tier opens what, the free party seat, and how long a wage lasts.
// The tier numbers are config (standing.ladder.unlocks); an unknown key stays closed.

export const unlocked = (l: LadderConfig, key: string, tier: number) => tier >= (l.unlocks[key] ?? Number.POSITIVE_INFINITY);

// The lowest free seat 1..max (the player has their own place), or null when the party is full.
export function freeSeat(taken: readonly number[], max: number): number | null {
  for (let s = 1; s <= max; s++) if (!taken.includes(s)) return s;
  return null;
}

// How far one wage payment reaches: hireDays world days of hourMs-long world hours.
export const wageMs = (l: LadderConfig, hourMs: number) => l.hireDays * 24 * hourMs;

// A paid contract runs out at paid_until. Paying again before then adds to what is left.
export const paidUntil = (l: LadderConfig, hourMs: number, now: number, current: number | null) =>
  Math.max(now, current ?? 0) + wageMs(l, hourMs);
