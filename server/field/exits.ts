import type { Exit, Point } from './types.ts';

// Where a field's exits sit. A hex field has one exit per hex direction d0-d5, where a ray from its centre at
// d * 60 degrees meets the edge. A corridor along a border mirrors that: it is entered where the hex it comes from
// would lie (the opposite direction) and left where the hex it goes to would lie, so the way on keeps its direction
// from field to field. Pure.

export const HEX_DIRECTIONS = 6;

export function hexExit(d: number, w: number, h: number): Point {
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const angle = (d * 2 * Math.PI) / HEX_DIRECTIONS;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const t = Math.min(Math.abs(dx) < 1e-9 ? Infinity : cx / Math.abs(dx), Math.abs(dy) < 1e-9 ? Infinity : cy / Math.abs(dy));
  return { x: Math.round(cx + dx * t), y: Math.round(cy + dy * t) };
}

// A corridor whose border runs in hex direction `dir` (from hex A to hex B): a toward A, b toward B.
export function corridorExits(dir: number, w: number, h: number): Exit[] {
  return [{ id: 'a', ...hexExit((dir + 3) % HEX_DIRECTIONS, w, h) }, { id: 'b', ...hexExit(dir, w, h) }];
}

// How far along the way from `a` to `b` the tile (x, y) lies, 0 at a and 1 at b (the corridor's biome blend follows it).
export function progress(a: Point, b: Point, x: number, y: number): number {
  const vx = b.x - a.x, vy = b.y - a.y;
  const len = vx * vx + vy * vy;
  if (len === 0) return 0.5;
  return Math.min(1, Math.max(0, ((x - a.x) * vx + (y - a.y) * vy) / len));
}

// The tiles that count as one exit: the exit tile and the one beside it on each side along the edge (3 wide, easy to
// find and to hit). Only hex fields and corridors widen their exits; a room's door or a town gate stays one tile.
export const EXIT_WIDTH = 3;
export function exitBand(e: Exit, w: number, h: number, kind: string): Exit[] {
  if (kind !== 'open' && kind !== 'corridor') return [e];
  const alongX = e.y === 0 || e.y === h - 1;
  const reach = Math.floor(EXIT_WIDTH / 2);
  const band: Exit[] = [];
  for (let k = -reach; k <= reach; k++) {
    const x = alongX ? e.x + k : e.x, y = alongX ? e.y : e.y + k;
    if (x >= 0 && y >= 0 && x < w && y < h) band.push({ id: e.id, x, y });
  }
  return band;
}
export const exitTiles = (exits: Exit[], w: number, h: number, kind: string): Exit[] => exits.flatMap((e) => exitBand(e, w, h, kind));
