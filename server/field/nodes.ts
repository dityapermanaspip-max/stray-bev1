import { createRng } from '../util/rng.ts';
import { layerSeed } from './noise.ts';
import { tileAt, type FieldGrid, type FieldSpec, type ResourceNode } from './types.ts';

// Resource nodes of a field, from its seed and biome node counts (never stored; only what was taken is).
// A corridor mixes its two biomes' counts by its place in the chain. Nodes stand on open walkable ground, never in
// a town's square, on a door, or by an exit or the spawn, and never next to each other. A kind with `near` terrains
// (fishing: water) only stands beside one of them.

const NODE_LAYER = 7;
const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function placeNodes(grid: FieldGrid, spec: FieldSpec, near: Record<string, string[]>): ResourceNode[] {
  const rng = createRng(layerSeed(spec.seed, NODE_LAYER));
  const b = spec.biomeB ?? spec.biomeA;
  const mid = (spec.blend.from + spec.blend.to) / 2;
  const kinds = [...new Set([...Object.keys(spec.biomeA.nodes), ...Object.keys(b.nodes)])].sort();
  const blocked = new Set<string>();
  for (const p of [grid.spawn, ...grid.exits]) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) blocked.add(`${p.x + dx},${p.y + dy}`);
  const nodes: ResourceNode[] = [];
  for (const kind of kinds) {
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
      if (blocked.has(`${s.x},${s.y}`)) continue;
      nodes.push({ id: nodes.length, kind, x: s.x, y: s.y, rank: rng() });
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) blocked.add(`${s.x + dx},${s.y + dy}`);
      placed++;
    }
  }
  return nodes;
}

export const nodeAt = (grid: FieldGrid, x: number, y: number): ResourceNode | null => grid.nodes.find((n) => n.x === x && n.y === y) ?? null;

// The field's hidden corruption share from its creature counts (0 when empty).
export function corruptionShare(rows: { natives: number; corrupted: number }[]): number {
  const total = rows.reduce((s, r) => s + r.natives + r.corrupted, 0);
  return total > 0 ? rows.reduce((s, r) => s + r.corrupted, 0) / total : 0;
}

export const isDark = (node: ResourceNode, share: number) => node.rank < share;
