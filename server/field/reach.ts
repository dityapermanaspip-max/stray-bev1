import { canStep, placeSlope, slopeFits, STEPS } from './climb.ts';
import type { Biome, FieldGrid, Point } from './types.ts';

// Every exit must be reachable from the spawn, and no walkable pocket may be cut off.
// Cliffs between the reached area and a pocket get a slope first; exits still cut off get a path carved
// toward the spawn (opened and evened out); leftover pockets are filled in.

const point = (g: FieldGrid, i: number): Point => ({ x: i % g.width, y: Math.floor(i / g.width) });

// Tiles reachable from `from` by steps the climbing rule allows.
export function reachable(g: FieldGrid, from: Point): Set<number> {
  const seen = new Set<number>();
  const start = from.y * g.width + from.x;
  if (!g.tiles[start]?.walkable) return seen;
  const queue = [start];
  seen.add(start);
  while (queue.length > 0) {
    const p = point(g, queue.pop()!);
    for (const [dx, dy] of STEPS) {
      const n = { x: p.x + dx, y: p.y + dy };
      const ni = n.y * g.width + n.x;
      if (seen.has(ni) || !canStep(g, p, n)) continue;
      seen.add(ni);
      queue.push(ni);
    }
  }
  return seen;
}

const heaviest = (weights: Record<string, number>) =>
  Object.entries(weights).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];

// One slope on a cliff between the reached area and an unreached walkable tile. False when none fits.
function bridgeOnce(g: FieldGrid, seen: Set<number>): boolean {
  for (let i = 0; i < g.tiles.length; i++) {
    if (!g.tiles[i].walkable || seen.has(i)) continue;
    const p = point(g, i);
    for (const [dx, dy] of STEPS) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (!seen.has(n.y * g.width + n.x)) continue;
      // The lower side becomes the slope, whichever side that is.
      if (slopeFits(g, p, n)) return placeSlope(g, p, n), true;
      if (slopeFits(g, n, p)) return placeSlope(g, n, p), true;
    }
  }
  return false;
}

// Walks from the exit toward the spawn (x first, then y), opening blocked tiles and evening out
// each step to at most one level, until it steps onto the reached area.
function carve(g: FieldGrid, from: Point, to: Point, seen: Set<number>, biomes: Record<string, Biome>): void {
  const route: Point[] = [{ ...from }];
  for (let { x, y } = from; x !== to.x || y !== to.y; route.push({ x, y })) {
    if (x !== to.x) x += Math.sign(to.x - x);
    else y += Math.sign(to.y - y);
  }
  let prev: Point | null = null;
  for (const p of route) {
    if (prev && seen.has(p.y * g.width + p.x) && canStep(g, prev, p)) return;
    const t = g.tiles[p.y * g.width + p.x];
    if (prev) {
      const last = g.tiles[prev.y * g.width + prev.x].height;
      t.slope = null;
      if (Math.abs(t.height - last) > 1) t.height = last + Math.sign(t.height - last);
    }
    if (!t.walkable) {
      t.walkable = true;
      t.terrain = heaviest(biomes[t.biome]?.ground ?? {}) ?? t.terrain;
    }
    prev = p;
  }
}

export function connectField(g: FieldGrid, biomes: Record<string, Biome>): void {
  let seen = reachable(g, g.spawn);
  while (seen.size < g.tiles.filter((t) => t.walkable).length && bridgeOnce(g, seen)) seen = reachable(g, g.spawn);
  for (const exit of g.exits) {
    if (!seen.has(exit.y * g.width + exit.x)) {
      carve(g, exit, g.spawn, seen, biomes);
      seen = reachable(g, g.spawn);
    }
  }
  g.tiles.forEach((t, i) => {
    if (!t.walkable || seen.has(i)) return;
    t.walkable = false;
    t.slope = null;
    t.terrain = heaviest(biomes[t.biome]?.obstacles ?? {}) ?? t.terrain;
  });
}
