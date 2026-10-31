import type { WorldGenConfig } from '../config/worldgen_config.ts';
import { HEX_DIRS } from '../field/links.ts';
import type { Rng } from '../util/rng.ts';
import { hexDistance } from '../world/world_hour.ts';

// The layout of a new round, from a seed: every hex out to the outer ring, towns per ring kept apart, a biome per
// hex (the centre fixed, the rest by ring weights, grown in patches), and one border per pair of neighbors with
// 3-7 corridors. Pure: the same seed gives the same plan. worldgen_repo.ts writes it.

export type PlanHex = { q: number; r: number; ring: number; town: boolean; biome: string; seed: number };
export type PlanBorder = { a: number; b: number; corridors: number[] }; // hex indexes; one seed per corridor
export type WorldPlan = { hexes: PlanHex[]; borders: PlanBorder[] };

const seedOf = (rng: Rng) => Math.floor(rng() * 2 ** 31);

// Every axial (q, r) within `rings` of the centre, centre first, then ring by ring.
export function hexesWithin(rings: number): { q: number; r: number; ring: number }[] {
  const out: { q: number; r: number; ring: number }[] = [];
  for (let q = -rings; q <= rings; q++) {
    for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r++) out.push({ q, r, ring: hexDistance({ q: 0, r: 0 }, { q, r }) });
  }
  return out.sort((a, b) => a.ring - b.ring || a.q - b.q || a.r - b.r);
}

export function shuffle<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function weighted(weights: [string, number][], rng: Rng): string {
  const total = weights.reduce((n, [, w]) => n + w, 0);
  let x = rng() * total;
  for (const [k, w] of weights) if ((x -= w) < 0) return k;
  return weights[weights.length - 1][0];
}

const TOWN_TRIES = 50; // shuffles tried before settling for the placement with the most towns

// Towns at least town_spacing apart: a few random tries, keeping the first that seats every ring's count
// (or the fullest one, if the spacing leaves no room).
function placeTowns(g: WorldGenConfig, cells: { q: number; r: number; ring: number }[], rng: Rng): Set<number> {
  const want = [...g.towns.values()].reduce((n, x) => n + x, 0);
  let best = new Set<number>();
  for (let i = 0; i < TOWN_TRIES && best.size < want; i++) {
    const towns = tryTowns(g, cells, rng);
    if (towns.size > best.size) best = towns;
  }
  return best;
}

// One try, outer ring first.
function tryTowns(g: WorldGenConfig, cells: { q: number; r: number; ring: number }[], rng: Rng): Set<number> {
  const towns = new Set<number>();
  const rings = [...new Set(cells.map((c) => c.ring))].sort((a, b) => b - a);
  for (const ring of rings) {
    let want = g.towns.get(ring) ?? 0;
    for (const i of shuffle(cells.map((c, i) => i).filter((i) => cells[i].ring === ring), rng)) {
      if (want <= 0) break;
      if ([...towns].some((t) => hexDistance(cells[t], cells[i]) < g.townSpacing)) continue;
      towns.add(i);
      want--;
    }
  }
  return towns;
}

// Biomes in patches: each hex in random order picks by its ring's weights, times (1 + clump) per neighbor that
// already has that biome. The boss hex is the centre biome.
function placeBiomes(g: WorldGenConfig, cells: { q: number; r: number; ring: number }[], rng: Rng): string[] {
  const at = new Map(cells.map((c, i) => [`${c.q},${c.r}`, i]));
  const biome: string[] = cells.map((c) => (c.ring === 0 ? g.centreBiome : ''));
  for (const i of shuffle(cells.map((_, i) => i).filter((i) => cells[i].ring > 0), rng)) {
    const c = cells[i];
    const near = HEX_DIRS.map(([dq, dr]) => at.get(`${c.q + dq},${c.r + dr}`)).filter((j): j is number => j !== undefined).map((j) => biome[j]);
    const weights = Object.entries(g.biomes.get(c.ring) ?? {})
      .filter(([, w]) => w > 0)
      .map(([b, w]): [string, number] => [b, w * (1 + g.clump) ** near.filter((x) => x === b).length]);
    biome[i] = weights.length > 0 ? weighted(weights, rng) : g.centreBiome;
  }
  return biome;
}

export function planWorld(g: WorldGenConfig, rings: number, rng: Rng): WorldPlan {
  const cells = hexesWithin(rings);
  const towns = placeTowns(g, cells, rng);
  const biomes = placeBiomes(g, cells, rng);
  const hexes = cells.map((c, i) => ({ ...c, town: towns.has(i), biome: biomes[i], seed: seedOf(rng) }));
  const at = new Map(cells.map((c, i) => [`${c.q},${c.r}`, i]));
  const borders: PlanBorder[] = [];
  const [lo, hi] = g.corridors;
  cells.forEach((c, a) => {
    for (const [dq, dr] of HEX_DIRS.slice(0, 3)) { // three directions: each neighbor pair once
      const b = at.get(`${c.q + dq},${c.r + dr}`);
      if (b === undefined) continue;
      const count = lo + Math.floor(rng() * (hi - lo + 1));
      borders.push({ a, b, corridors: Array.from({ length: count }, () => seedOf(rng)) });
    }
  });
  return { hexes, borders };
}
