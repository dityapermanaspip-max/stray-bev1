import { tileAt, type FieldGrid, type Point } from './types.ts';

// Climbing between tiles (decided 2026-11-02, replaces slopes). Heights run 0-5 and every tile is a flat block.
// A step between walkable neighbours is allowed when their heights differ by at most one level; two or more is a
// cliff. Tiles keep a `slope` field for the view format, always null.

export const MAX_HEIGHT = 5;
export const CLIMB = 1; // most levels one step may rise or drop
export const STEPS: readonly [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export const dirOf = (dx: number, dy: number) => STEPS.findIndex(([sx, sy]) => sx === dx && sy === dy);

export function canStep(g: FieldGrid, from: Point, to: Point): boolean {
  const a = tileAt(g, from.x, from.y);
  const b = tileAt(g, to.x, to.y);
  if (!a?.walkable || !b?.walkable) return false;
  if (Math.abs(to.x - from.x) + Math.abs(to.y - from.y) !== 1) return false;
  return Math.abs(a.height - b.height) <= CLIMB;
}

// The height closest to `h` that a step from a tile at `next` allows.
export const meetHeight = (h: number, next: number) => Math.max(next - CLIMB, Math.min(next + CLIMB, h));
