import type { BalanceConfig } from '../config/balance.ts';
import { LOAD_TIERS } from '../inventory/bag.ts';
import type { Point } from './types.ts';

// Server-side walking: a walker follows its path at a fixed tile rate. The room clock calls advance().

export type Walker = Point & { path: Point[]; progress: number };

export const newWalker = (at: Point): Walker => ({ x: at.x, y: at.y, path: [], progress: 0 });

// Tiles per second for a load tier: the last tier cannot move, the one before it walks slower.
export function walkSpeed(cfg: BalanceConfig, loadTier: number): number {
  if (loadTier >= LOAD_TIERS) return 0;
  const slow = loadTier === LOAD_TIERS - 1 ? cfg.gear.weightLimits.slow_walk_mult : 1;
  return cfg.walk.tilesPerSecond * slow;
}

// Moves the walker by the time passed. Returns the tiles entered, in order (usually zero or one).
export function advance(w: Walker, seconds: number, tilesPerSecond: number): Point[] {
  const entered: Point[] = [];
  if (w.path.length === 0) {
    w.progress = 0;
    return entered;
  }
  w.progress += seconds * tilesPerSecond;
  while (w.progress >= 1 && w.path.length > 0) {
    const next = w.path.shift()!;
    w.x = next.x;
    w.y = next.y;
    w.progress -= 1;
    entered.push(next);
  }
  if (w.path.length === 0) w.progress = 0;
  return entered;
}
