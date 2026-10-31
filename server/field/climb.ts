import { tileAt, type FieldGrid, type Point, type Tile } from './types.ts';

// Climbing between tiles. Heights run 0-3. A step may rise or drop one level; two or more needs a slope.
// A slope tile sits between levels: its downhill edge is one level below its height, its uphill edge one above,
// so one slope bridges a rise of 2, and a slope plus a free step bridges 3.

export const MAX_HEIGHT = 3;
export const STEPS: readonly [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // slope directions point uphill

const dirOf = (dx: number, dy: number) => STEPS.findIndex(([sx, sy]) => sx === dx && sy === dy);

// Height of a tile's edge facing (dx, dy).
export function edgeHeight(t: Tile, dx: number, dy: number): number {
  if (t.slope === null) return t.height;
  const d = dirOf(dx, dy);
  if (d === t.slope) return t.height + 1;
  if (d === (t.slope + 2) % 4) return t.height - 1;
  return t.height; // the sides of a slope meet at its middle
}

export function canStep(g: FieldGrid, from: Point, to: Point): boolean {
  const a = tileAt(g, from.x, from.y);
  const b = tileAt(g, to.x, to.y);
  if (!a?.walkable || !b?.walkable) return false;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
  return Math.abs(edgeHeight(a, dx, dy) - edgeHeight(b, -dx, -dy)) <= 1;
}

// A cliff where `low` could become a slope rising toward `high` (a rise of 2 or 3 between flat tiles).
export function slopeFits(g: FieldGrid, low: Point, high: Point): boolean {
  const a = tileAt(g, low.x, low.y);
  const b = tileAt(g, high.x, high.y);
  if (!a?.walkable || !b?.walkable || a.slope !== null || b.slope !== null) return false;
  const rise = b.height - a.height;
  return rise >= 2 && rise <= MAX_HEIGHT && a.height + 1 <= MAX_HEIGHT;
}

// Turns `low` into a slope rising toward `high`. Its downhill edge keeps its old height.
export function placeSlope(g: FieldGrid, low: Point, high: Point): void {
  const t = tileAt(g, low.x, low.y)!;
  t.height += 1;
  t.slope = dirOf(high.x - low.x, high.y - low.y);
}
