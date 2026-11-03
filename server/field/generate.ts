import { createRng, type Rng } from '../util/rng.ts';
import { corridorExits, HEX_DIRECTIONS, hexExit, progress } from './exits.ts';
import { layerSeed, valueNoise } from './noise.ts';
import { connectField } from './reach.ts';
import { applyTown } from './town.ts';
import type { Biome, Exit, FieldGrid, FieldSpec, Point, Tile } from './types.ts';

// Builds a field from template + biome(s) + seed. The same spec always gives the same field.
// Each tile picks biome A or B (corridors shift from A to B along their length), then a hill height,
// then water or swamp on part of the lowest ground, then blocked or not (clumped by noise, mean = biome density
// x template mult), then a weighted terrain. Towns lay their safe middle over that. Then the field is made fully
// reachable by legal steps (climb.ts: one level up or down; reach.ts: levelled tiles, carved paths).

const LAYER = { biome: 1, hills: 2, obstacles: 3, terrain: 4, lowland: 5 };

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

// The town miniature of a hex that holds a town: a walled block around the centre, its gate just below it.
const gateAt = (w: number, h: number) => ({ x: Math.floor(w / 2), y: Math.floor(h / 2) + 2 });
const MINI = 1; // the block reaches this many tiles from the centre

function exitsFor(spec: FieldSpec): Exit[] {
  const { width: w, height: h, kind } = spec.template;
  const mid = Math.floor(w / 2);
  if (kind === 'corridor') return spec.dir === undefined ? [{ id: 'a', x: mid, y: 0 }, { id: 'b', x: mid, y: h - 1 }] : corridorExits(spec.dir, w, h);
  if (kind === 'town') return [{ id: 'gate', x: mid, y: h - 1 }]; // a town field's only way out: back to its hex
  const gate = spec.gate ? [{ id: 'gate', ...gateAt(w, h) }] : [];
  // One exit per hex direction, where a ray from the center meets the edge.
  return Array.from({ length: HEX_DIRECTIONS }, (_, d) => ({ id: `d${d}`, ...hexExit(d, w, h) })).concat(gate);
}

// Stamps the walled town block over the middle of a hex field that holds a town (drawn like town buildings).
// Answers the block's tiles, which carved ramps never cut through.
function townMiniature(g: FieldGrid): Set<number> {
  const block = new Set<number>();
  const cx = Math.floor(g.width / 2);
  const cy = Math.floor(g.height / 2);
  const ground = g.tiles[cy * g.width + cx].height;
  for (let y = cy - MINI; y <= cy + MINI; y++) {
    for (let x = cx - MINI; x <= cx + MINI; x++) {
      Object.assign(g.tiles[y * g.width + x], { terrain: 'building', walkable: false, slope: null, height: ground });
      block.add(y * g.width + x);
    }
  }
  const gate = g.tiles[(cy + MINI + 1) * g.width + cx];
  Object.assign(gate, { walkable: true, slope: null, height: ground });
  return block;
}

// Exits, the spawn and their neighbors are always open ground.
function keepClear(spawn: Point, exits: Exit[]): Set<string> {
  const keep = new Set<string>();
  for (const p of [spawn, ...exits]) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) keep.add(`${p.x + dx},${p.y + dy}`);
  }
  return keep;
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

  const spawn = spec.gate ? { ...gateAt(width, height), y: gateAt(width, height).y + 1 } : { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const exits = exitsFor(spec);
  const clear = keepClear(spawn, exits);

  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const along = template.kind !== 'corridor' ? 0.5 : spec.dir === undefined ? (height > 1 ? y / (height - 1) : 0.5) : progress(exits[0], exits[1], x, y);
      const bShare = spec.blend.from + (spec.blend.to - spec.blend.from) * along;
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
  const grid: FieldGrid = { width, height, tiles, spawn, exits, nodes: [] };
  if (template.town) applyTown(grid, template.town, spec.seed);
  const block = spec.gate && template.kind === 'open' ? townMiniature(grid) : new Set<number>();
  const biomes = { [biomeA.name]: biomeA, [biomeB.name]: biomeB };
  connectField(grid, biomes, block);
  return grid;
}
