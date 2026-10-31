import { createRng, type Rng } from '../util/rng.ts';
import { placeSlope, slopeFits, STEPS } from './climb.ts';
import { layerSeed, valueNoise } from './noise.ts';
import { connectField } from './reach.ts';
import { applyTown } from './town.ts';
import type { Biome, Exit, FieldGrid, FieldSpec, Point, Tile } from './types.ts';

// Builds a field from template + biome(s) + seed. The same spec always gives the same field.
// Each tile picks biome A or B (corridors shift from A to B along their length), then a hill height,
// then water or swamp on part of the lowest ground, then blocked or not (clumped by noise, mean = biome density
// x template mult), then a weighted terrain. Towns lay their safe middle over that. Then some cliffs get slopes,
// and the field is made fully reachable.

const LAYER = { biome: 1, hills: 2, obstacles: 3, terrain: 4, lowland: 5, slopes: 6 };
const HEX_DIRECTIONS = 6;

function weighted(rng: Rng, weights: Record<string, number>): string {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [name, w] of entries) {
    roll -= w;
    if (roll < 0) return name;
  }
  return entries[entries.length - 1]?.[0] ?? 'ground';
}

// Corridor p of n between hex A and hex B: the first starts at pure A, the last ends at pure B.
export function corridorBlend(position: number, count: number): { from: number; to: number } {
  const n = Math.max(1, count);
  return { from: (position - 1) / n, to: position / n };
}

function exitsFor(spec: FieldSpec): Exit[] {
  const { width: w, height: h, kind } = spec.template;
  const mid = Math.floor(w / 2);
  if (kind === 'corridor') return [{ id: 'a', x: mid, y: 0 }, { id: 'b', x: mid, y: h - 1 }];
  // One exit per hex direction, where a ray from the center meets the edge.
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  return Array.from({ length: HEX_DIRECTIONS }, (_, d) => {
    const angle = (d * 2 * Math.PI) / HEX_DIRECTIONS;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const t = Math.min(dx === 0 ? Infinity : cx / Math.abs(dx), dy === 0 ? Infinity : cy / Math.abs(dy));
    return { id: `d${d}`, x: Math.round(cx + dx * t), y: Math.round(cy + dy * t) };
  });
}

// Exits, the spawn and their neighbors are always open ground.
function keepClear(spawn: Point, exits: Exit[]): Set<string> {
  const keep = new Set<string>();
  for (const p of [spawn, ...exits]) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) keep.add(`${p.x + dx},${p.y + dy}`);
  }
  return keep;
}

// Some cliffs get a slope by chance (the biome's slope_share), so hills are not only reached by forced paths.
function naturalSlopes(g: FieldGrid, biomes: Record<string, Biome>, rng: Rng): void {
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const share = biomes[g.tiles[y * g.width + x].biome]?.slopeShare ?? 0;
      for (const [dx, dy] of STEPS) {
        const high = { x: x + dx, y: y + dy };
        if (slopeFits(g, { x, y }, high) && rng() < share) placeSlope(g, { x, y }, high);
      }
    }
  }
}

export function generateField(spec: FieldSpec): FieldGrid {
  const { template, biomeA, seed } = spec;
  const biomeB = spec.biomeB ?? biomeA;
  const { width, height } = template;
  const biomeNoise = valueNoise(layerSeed(seed, LAYER.biome), 3, width, height);
  const hillNoise = valueNoise(layerSeed(seed, LAYER.hills), Math.max(biomeA.hills.scale, biomeB.hills.scale), width, height);
  const obstacleNoise = valueNoise(layerSeed(seed, LAYER.obstacles), 3, width, height);
  const lowlandNoise = valueNoise(layerSeed(seed, LAYER.lowland), 4, width, height);
  const rng = createRng(layerSeed(seed, LAYER.terrain));

  const spawn = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const exits = exitsFor(spec);
  const clear = keepClear(spawn, exits);

  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    const along = template.kind === 'corridor' && height > 1 ? y / (height - 1) : 0.5;
    const bShare = spec.blend.from + (spec.blend.to - spec.blend.from) * along;
    for (let x = 0; x < width; x++) {
      const biome: Biome = biomeNoise(x, y) < bShare ? biomeB : biomeA;
      const hills = biomeA.hills.max + (biomeB.hills.max - biomeA.hills.max) * bShare;
      const steep = biomeA.hills.steep + (biomeB.hills.steep - biomeA.hills.steep) * bShare;
      const lifted = Math.min(1, Math.max(0, (hillNoise(x, y) - 0.5) * steep + 0.5)); // contrast makes plateaus
      const tileHeight = Math.min(Math.floor(hills), Math.floor(lifted * (hills + 1)));
      const density = Math.min(1, biome.obstacleDensity * template.obstacleMult);
      const kept = clear.has(`${x},${y}`);
      const wet = !kept && tileHeight === 0 && lowlandNoise(x, y) < biome.lowland.share;
      const blocked = wet || (!kept && rng() < density * 2 * obstacleNoise(x, y));
      tiles.push({
        terrain: weighted(rng, wet ? biome.lowland.terrain : blocked ? biome.obstacles : biome.ground),
        biome: biome.name,
        height: tileHeight,
        walkable: !blocked,
        slope: null,
      });
    }
  }
  const grid: FieldGrid = { width, height, tiles, spawn, exits };
  if (template.town) applyTown(grid, template.town);
  const biomes = { [biomeA.name]: biomeA, [biomeB.name]: biomeB };
  naturalSlopes(grid, biomes, createRng(layerSeed(seed, LAYER.slopes)));
  connectField(grid, biomes);
  return grid;
}
