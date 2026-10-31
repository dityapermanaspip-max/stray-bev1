import type { BalanceConfig } from '../config/balance.ts';
import type { Recipe, Town } from '../data/economy_repo.ts';
import type { Biome } from '../field/types.ts';
import type { ItemCatalog } from '../inventory/items.ts';
import type { LootData } from '../inventory/loot.ts';
import type { Rng } from '../util/rng.ts';
import { conversionRate } from '../config/world_config.ts';
import { firesAt } from './clock.ts';
import { birth, conversion, feeding, type PopRow } from './population.ts';
import { townTick, type AreaHex, type TickReport } from './town_tick.ts';

// One world hour on counts (pure; the tick repo loads and saves, the simulator keeps it in memory):
// the population rules due this hour on every hex, then each town's tick if due, its workers ranging over the hexes
// within reach (axial distance). Changes the rows and towns in place; answers each town's report.

export type TickWorld = { cfg: BalanceConfig; catalog: ItemCatalog; loot: LootData; recipes: Recipe[]; biomes: Map<string, Biome>; rng: Rng };
export type HexInfo = { id: string; q: number; r: number; ring: number; biome: string | null };
export type TickTown = { town: Town; population: number; jobs: Record<string, number> }; // jobs: job -> workforce share

export const hexDistance = (a: Pick<HexInfo, 'q' | 'r'>, b: Pick<HexInfo, 'q' | 'r'>) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;

// Share of a biome's tiles that are trees (obstacle density x the tree weight among obstacles).
export function treeShare(w: TickWorld, biome: string | null): number {
  const b = biome ? w.biomes.get(biome) : undefined;
  if (!b) return 0;
  const weights = Object.values(b.obstacles).reduce((n, x) => n + x, 0);
  return weights > 0 ? b.obstacleDensity * ((b.obstacles[w.cfg.townTick.wood.terrain] ?? 0) / weights) : 0;
}

export const townDue = (w: TickWorld, hour: number) => firesAt(w.cfg.townTick.intervalHours, hour) > 0;

export function runHour(w: TickWorld, hexes: HexInfo[], pop: Map<string, PopRow[]>, towns: TickTown[], hour: number): Map<string, TickReport> {
  const t = w.cfg.ticks;
  for (const [ref, rows] of pop) {
    const ring = hexes.find((h) => h.id === ref)?.ring ?? w.cfg.rings.count;
    const rate = conversionRate(w.cfg.rings, t.conversion.rate, ring); // more corruption closer to the centre
    for (const p of rows) {
      for (let i = firesAt(t.birth.intervalHours, hour); i > 0; i--) birth(t, p);
      for (let i = firesAt(t.conversion.intervalHours, hour); i > 0; i--) conversion(t, p, rate);
      for (let i = firesAt(t.feeding.intervalHours, hour); i > 0; i--) feeding(t, p);
    }
  }
  const reports = new Map<string, TickReport>();
  if (!townDue(w, hour)) return reports;
  for (const { town, population, jobs } of towns) {
    const home = hexes.find((h) => h.id === town.ref);
    if (!home) continue;
    const area: AreaHex[] = hexes
      .filter((h) => hexDistance(home, h) <= w.cfg.townTick.reach)
      .map((h) => ({ ref: h.id, trees: treeShare(w, h.biome), pop: pop.get(h.id) ?? [] }));
    reports.set(town.ref, townTick({ cfg: w.cfg, catalog: w.catalog, loot: w.loot, recipes: w.recipes, town, population, jobs, area, rng: w.rng }));
  }
  return reports;
}
