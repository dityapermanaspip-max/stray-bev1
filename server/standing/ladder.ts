import type { LadderConfig } from '../config/standing_config.ts';
import type { Rng } from '../util/rng.ts';

// The favor ladder (hidden rules). Each NPC has its own base threshold T. Step 1 is T, each next step is the one
// before times step_mult (rounded up), and a tier needs the sum of the steps so far. Tier 0 is a stranger.
// Nothing here reaches the client except the tier word.

// Rounds up, ignoring float dust (20 x 1.35 is 27, not 28).
const up = (x: number) => Math.ceil(x - 1e-9);

// Favor needed for tiers 1..tiers (T = 20: 20, 47, 84, 134, 202, 294, 419, 588, 817, 1127).
export function thresholds(l: LadderConfig, base: number): number[] {
  const out: number[] = [];
  let step = base;
  let total = 0;
  for (let i = 0; i < l.tiers; i++) {
    total += step;
    out.push(total);
    step = up(step * l.stepMult);
  }
  return out;
}

// The tier favor reaches, held down to capTier (a same-body-type pair stops short of the top).
export const tierOf = (l: LadderConfig, base: number, favor: number, capTier = l.tiers) =>
  Math.min(capTier, thresholds(l, base).filter((t) => favor >= t).length);

// The cap for a pair: the same body type (both known) stops at sameSexMaxTier.
export const pairCap = (l: LadderConfig, a: string | null, b: string | null) => (a && b && a === b ? l.sameSexMaxTier : l.tiers);

// Favor from one talk: charm x (1 + town fame / fameDiv), never under charm x fameFloor (a hated name is slow, not draining).
export const talkFavor = (l: LadderConfig, charm: number, townFame: number) => charm * Math.max(l.fameFloor, 1 + townFame / l.fameDiv);

// An NPC's own base threshold: its role's base, spread either way by the roll, at least 1.
export function rollBase(l: LadderConfig, role: string, rng: Rng): number {
  const r = l.roles[role] ?? l.roles.default;
  return Math.max(1, Math.round(r.base * (1 - r.spread + 2 * r.spread * rng())));
}

// The world tick a world hour falls in; the talk cap counts per tick.
export const tickOf = (l: LadderConfig, worldHours: number) => Math.floor(worldHours / l.talkTickHours);

// The gift menu: open from minTier, one gift per perDays real days.
export function canGift(l: LadderConfig, tier: number, lastGiftAt: Date | null, now: Date): boolean {
  if (tier < l.gift.minTier) return false;
  return lastGiftAt === null || now.getTime() - lastGiftAt.getTime() >= l.gift.perDays * 86_400_000;
}

// A shop turns away a player whose fame in its town is at or under the line.
export const shopRefuses = (l: LadderConfig, townFame: number) => townFame <= l.refuseFame;
