import { createRng } from '../util/rng.ts';
import { CLIMB } from './climb.ts';
import { layerSeed } from './noise.ts';
import { findPath, findPathToAny } from './path.ts';
import { reachable } from './reach.ts';
import { tileAt, type FieldGrid, type FieldSpec, type Point, type ResourceNode } from './types.ts';

// Resource nodes of a field, from its seed and biome node counts (never stored; only what was taken is).
// A corridor mixes its two biomes' counts by its place in the chain. Nodes stand on open walkable ground, never in
// a town's square, on a door, or by an exit or the spawn, and never next to each other. A kind with `near` terrains
// (fishing: water) only stands beside one of them.
// A node is an obstacle (decided 2026-11-02): its tile turns unwalkable and it is worked from a tile beside it
// (beside = a 4-neighbour within a climbing step). A spot is only taken when blocking it keeps every other walkable
// tile reachable from the spawn and leaves a reachable tile beside it. placeNodes changes the grid that way.
// `kinds`: only these kinds are placed (default: all of the biome's).

const NODE_LAYER = 7;
const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function placeNodes(grid: FieldGrid, spec: FieldSpec, near: Record<string, string[]>, kinds?: (kind: string) => boolean): ResourceNode[] {
  const rng = createRng(layerSeed(spec.seed, NODE_LAYER));
  const b = spec.biomeB ?? spec.biomeA;
  const mid = (spec.blend.from + spec.blend.to) / 2;
  const all = [...new Set([...Object.keys(spec.biomeA.nodes), ...Object.keys(b.nodes)])].sort().filter((k) => !kinds || kinds(k));
  const blocked = new Set<string>();
  for (const p of [grid.spawn, ...grid.exits]) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) blocked.add(`${p.x + dx},${p.y + dy}`);
  const nodes: ResourceNode[] = [];
  let open = reachable(grid, grid.spawn).size;
  for (const kind of all) {
    const count = Math.round((spec.biomeA.nodes[kind] ?? 0) * (1 - mid) + (b.nodes[kind] ?? 0) * mid);
    const terrains = near[kind] ?? [];
    const spots: { x: number; y: number }[] = [];
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const t = tileAt(grid, x, y)!;
        if (!t.walkable || t.safe || t.service || blocked.has(`${x},${y}`)) continue;
        if (terrains.length > 0 && !AROUND.some(([dx, dy]) => terrains.includes(tileAt(grid, x + dx, y + dy)?.terrain ?? ''))) continue;
        spots.push({ x, y });
      }
    }
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    let placed = 0;
    for (const s of spots) {
      if (placed >= count) break;
      if (blocked.has(`${s.x},${s.y}`) || !blocks(grid, s, open)) continue;
      open--;
      nodes.push({ id: nodes.length, kind, x: s.x, y: s.y, rank: rng() });
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) blocked.add(`${s.x + dx},${s.y + dy}`);
      placed++;
    }
  }
  return nodes;
}

// Blocks the tile at p when that keeps the rest reachable (`open` walkable tiles reachable before) with a tile
// beside it; else leaves it walkable. True when blocked.
function blocks(grid: FieldGrid, p: Point, open: number): boolean {
  const t = tileAt(grid, p.x, p.y)!;
  t.walkable = false;
  const seen = reachable(grid, grid.spawn);
  if (seen.size === open - 1 && AROUND.some(([dx, dy]) => seen.has((p.y + dy) * grid.width + p.x + dx) && besideOk(grid, { x: p.x + dx, y: p.y + dy }, p))) return true;
  t.walkable = true;
  return false;
}

// Standing at `at` counts as beside the node at `node`: a 4-neighbour within a climbing step.
function besideOk(grid: FieldGrid, at: Point, node: Point): boolean {
  const a = tileAt(grid, at.x, at.y), n = tileAt(grid, node.x, node.y);
  return !!a?.walkable && !!n && Math.abs(at.x - node.x) + Math.abs(at.y - node.y) === 1 && Math.abs(a.height - n.height) <= CLIMB;
}

// The node with this id when `at` stands beside it, else null.
export function nodeBeside(grid: FieldGrid, at: Point, id: number): ResourceNode | null {
  const n = grid.nodes.find((m) => m.id === id);
  return n && besideOk(grid, at, n) ? n : null;
}

// Tiles to stand on beside a node.
export const besideTiles = (grid: FieldGrid, node: Point): Point[] =>
  AROUND.map(([dx, dy]) => ({ x: node.x + dx, y: node.y + dy })).filter((p) => besideOk(grid, p, node));

// A walk toward (x, y): onto the tile, or beside it when a node stands there (the node it heads for).
export function walkPlan(grid: FieldGrid, from: Point, to: Point, maxSteps: number): { path: Point[] | null; node: ResourceNode | null } {
  const node = nodeAt(grid, to.x, to.y);
  return { node, path: node ? findPathToAny(grid, from, besideTiles(grid, node), maxSteps) : findPath(grid, from, to, maxSteps) };
}

export const nodeAt = (grid: FieldGrid, x: number, y: number): ResourceNode | null => grid.nodes.find((n) => n.x === x && n.y === y) ?? null;

// The field's hidden corruption share from its creature counts (0 when empty).
export function corruptionShare(rows: { natives: number; corrupted: number }[]): number {
  const total = rows.reduce((s, r) => s + r.natives + r.corrupted, 0);
  return total > 0 ? rows.reduce((s, r) => s + r.corrupted, 0) / total : 0;
}

export const isDark = (node: ResourceNode, share: number) => node.rank < share;
