import { canStep, meetHeight, STEPS } from './climb.ts';
import type { Biome, FieldGrid, Point, Tile } from './types.ts';

// Every exit must be reachable from the spawn, and no walkable pocket may be cut off (climbing rule: climb.ts).
// A pocket beside the reached area is joined by levelling one of its tiles to a step from its neighbour; exits still
// cut off get a path carved toward the spawn; leftover pockets are filled in. Cliffs elsewhere stay cliffs.

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

// Joins one unreached walkable tile to the reached area by changing only its height (so the reached area only grows
// and this ends): the smallest change that makes a step from a reached neighbour. Town tiles never change.
function bridgeOnce(g: FieldGrid, seen: Set<number>): boolean {
  let best: { t: Tile; height: number; cost: number } | null = null;
  for (let i = 0; i < g.tiles.length; i++) {
    const t = g.tiles[i];
    if (!t.walkable || seen.has(i) || t.safe || t.service) continue;
    const p = point(g, i);
    for (const [dx, dy] of STEPS) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (n.x < 0 || n.y < 0 || n.x >= g.width || n.y >= g.height || !seen.has(n.y * g.width + n.x)) continue;
      const height = meetHeight(t.height, g.tiles[n.y * g.width + n.x].height);
      const cost = Math.abs(t.height - height);
      if (!best || cost < best.cost) best = { t, height, cost };
    }
  }
  if (!best) return false;
  best.t.height = best.height;
  return true;
}

// Lays a walkable path from an exit cut off by blocked tiles to the reached area. The route is a shortest search over
// any tile except other exits, town tiles and `protect` (the town block of a hex), ending on the first reached tile.
// It is laid backward from there, so only unreached tiles change: each opens and moves to within a step of the tile
// after it, as close to its old height as it can.
function carve(g: FieldGrid, from: Point, seen: Set<number>, biomes: Record<string, Biome>, protect: ReadonlySet<number>): void {
  const idx = (p: Point) => p.y * g.width + p.x;
  const blocked = (i: number) => protect.has(i) || !!g.tiles[i].safe || !!g.tiles[i].service || g.exits.some((e) => idx(e) === i);
  const back = new Map<number, number>([[idx(from), -1]]);
  const queue = [idx(from)];
  let end = -1;
  for (let h = 0; h < queue.length && end < 0; h++) {
    const p = point(g, queue[h]);
    for (const [dx, dy] of STEPS) {
      const n = { x: p.x + dx, y: p.y + dy };
      const ni = idx(n);
      if (n.x < 0 || n.y < 0 || n.x >= g.width || n.y >= g.height || back.has(ni)) continue;
      if (seen.has(ni)) {
        back.set(ni, queue[h]);
        end = ni;
        break;
      }
      if (seen.has(ni) || blocked(ni)) continue;
      back.set(ni, queue[h]);
      queue.push(ni);
    }
  }
  if (end < 0) return;
  const route: Point[] = []; // exit first, the reached tile last
  for (let i = end; i !== -1; i = back.get(i)!) route.unshift(point(g, i));
  for (let i = route.length - 2; i >= 0; i--) {
    const p = route[i];
    const next = route[i + 1]; // already laid (or the reached tile)
    const t = g.tiles[idx(p)];
    if (!t.walkable) {
      t.walkable = true;
      t.terrain = heaviest(biomes[t.biome]?.ground ?? {}) ?? t.terrain;
    }
    t.height = meetHeight(t.height, g.tiles[idx(next)].height);
  }
}

export function connectField(g: FieldGrid, biomes: Record<string, Biome>, protect: ReadonlySet<number> = new Set()): void {
  let seen = reachable(g, g.spawn);
  while (seen.size < g.tiles.filter((t) => t.walkable).length && bridgeOnce(g, seen)) seen = reachable(g, g.spawn);
  for (const exit of g.exits) {
    if (!seen.has(exit.y * g.width + exit.x)) {
      carve(g, exit, seen, biomes, protect);
      seen = reachable(g, g.spawn);
    }
  }
  g.tiles.forEach((t, i) => {
    if (!t.walkable || seen.has(i)) return;
    t.walkable = false;
    t.terrain = heaviest(biomes[t.biome]?.obstacles ?? {}) ?? t.terrain;
  });
}
