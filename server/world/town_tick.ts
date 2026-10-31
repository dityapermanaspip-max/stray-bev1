import type { BalanceConfig } from '../config/balance.ts';
import { facilityLevel, type Recipe, type StockRow, type Town } from '../data/economy_repo.ts';
import { capacityOf, safeQty, sellPrice, stockMult, tradeable } from '../economy/prices.ts';
import { stackKey } from '../inventory/bag.ts';
import type { ItemCatalog } from '../inventory/items.ts';
import type { LootData } from '../inventory/loot.ts';
import type { Rng } from '../util/rng.ts';
import { chanceRound } from './clock.ts';
import type { PopRow } from './population.ts';

// One town tick (hidden, counts only), from the settlement's population. In order:
// 1. Villagers use goods per 100 people per item type, spread over what is in stock, less of what is dear and more of
//    what is cheap (divided by the stock price multiplier); they may eat into the safe stock. They pay into the purse.
// 2. The workforce (population x workforce_share, spread by the town's job shares) works as far as the purse pays its
//    wages: hunters catch natives in the hexes within reach (density of natives above the safe floor, less where
//    corruption is rife) and bring in that species' native loot yield; the catch leaves the hex's natural count.
//    Woodcutters bring logs from the best forest in reach. Craftsmen (jobs with recipes) turn stock above the safe
//    stock into what the town has least of. Common jobs (farmer, laborer, guard, ...) feed the village: no store goods.
// 3. Stock is capped at capacity x max_fill. Taboo and untraded goods are never kept.

export type AreaHex = { ref: string; trees: number; pop: PopRow[] }; // trees: share of tiles that are trees
export type TickInput = {
  cfg: BalanceConfig; catalog: ItemCatalog; loot: LootData; recipes: Recipe[];
  town: Town; population: number; jobs: Record<string, number>; area: AreaHex[]; rng: Rng; // jobs: job -> share of the workforce
};
export type TickReport = { used: number; paid: number; wages: number; caught: number; logs: number; batches: number; hunted: { ref: string; species: string; n: number }[] };

const GATHER_JOBS = ['hunter', 'woodcutter'];

// Workers in a job: population x workforce share x the job's share.
export const workersIn = (t: Pick<TickInput, 'cfg' | 'population' | 'jobs'>, job: string) =>
  Math.round(t.population * t.cfg.townTick.workforceShare * (t.jobs[job] ?? 0));

function held(town: Town, item: string): number {
  let n = 0;
  for (const r of town.stock.values()) if (r.item === item) n += r.qty;
  return n;
}

function rowOf(town: Town, item: string, quality: string): StockRow {
  const key = stackKey(item, quality);
  const row = town.stock.get(key) ?? { item, quality, qty: 0 };
  town.stock.set(key, row);
  return row;
}

// Adds goods the town keeps (traded, not taboo). Answers how many were kept.
function bringIn(t: TickInput, item: string, qty: number): number {
  const def = t.catalog.get(item);
  if (!def || qty <= 0 || !tradeable(t.cfg.economy, def)) return 0;
  rowOf(t.town, item, def.defaultQuality).qty += qty;
  return qty;
}

function consume(t: TickInput, r: TickReport): void {
  const { economy, townTick } = t.cfg;
  const rows = [...t.town.stock.values()].filter((row) => {
    const def = t.catalog.get(row.item);
    return row.qty > 0 && !!def && tradeable(economy, def);
  });
  const typeOf = (row: StockRow) => t.catalog.get(row.item)!.type;
  const ofType = new Map<string, number>();
  for (const row of rows) ofType.set(typeOf(row), (ofType.get(typeOf(row)) ?? 0) + row.qty);
  let paid = 0;
  for (const row of rows) {
    const def = t.catalog.get(row.item)!;
    const cap = capacityOf(economy, def, t.town.specialties);
    const share = row.qty / ofType.get(def.type)!;
    const want = (((townTick.consumePer100[def.type] ?? 0) * t.population) / 100) * share / stockMult(economy, held(t.town, row.item), cap);
    const used = Math.min(row.qty, chanceRound(t.rng, want));
    if (used === 0) continue;
    paid += used * sellPrice(economy, def, row.quality, held(t.town, row.item), cap) * townTick.villagerPayShare;
    row.qty -= used;
    r.used += used;
  }
  r.paid = Math.floor(paid);
  t.town.purse += r.paid;
}

function hunt(t: TickInput, workers: number, r: TickReport): void {
  const rows = t.area.flatMap((h) => h.pop.map((p) => ({ ref: h.ref, p })));
  const above = (p: PopRow) => Math.max(0, p.natives - p.safe);
  const max = rows.reduce((n, x) => n + x.p.max, 0);
  const natives = rows.reduce((n, x) => n + x.p.natives, 0);
  const all = rows.reduce((n, x) => n + x.p.natives + x.p.corrupted, 0);
  if (max <= 0 || all <= 0) return;
  const density = Math.min(1, rows.reduce((n, x) => n + above(x.p), 0) / max);
  const catches = chanceRound(t.rng, workers * t.cfg.townTick.hunt.perWorker * density * (natives / all));
  for (let i = 0; i < catches; i++) {
    let roll = t.rng() * rows.reduce((n, x) => n + above(x.p), 0);
    const prey = rows.find((x) => (roll -= above(x.p)) < 0);
    if (!prey) return;
    prey.p.natives -= 1;
    r.caught += 1;
    const rec = r.hunted.find((h) => h.ref === prey.ref && h.species === prey.p.species);
    if (rec) rec.n += 1;
    else r.hunted.push({ ref: prey.ref, species: prey.p.species, n: 1 });
    for (const e of t.loot.bySpecies.get(prey.p.species)?.native ?? []) {
      bringIn(t, e.item, chanceRound(t.rng, (e.permille / 1000) * ((e.min + e.max) / 2)));
    }
  }
}

function cutWood(t: TickInput, workers: number, r: TickReport): void {
  const w = t.cfg.townTick.wood;
  const forest = Math.min(1, Math.max(0, ...t.area.map((h) => h.trees)) / w.fullShare);
  r.logs += bringIn(t, w.item, chanceRound(t.rng, workers * w.perWorker * forest));
}

// A craft job's workers make workers x per_worker batches, each time what the town has least of (by fill).
function craft(t: TickInput, job: string, workers: number, r: TickReport): void {
  const { economy } = t.cfg;
  const above = (item: string) => {
    const def = t.catalog.get(item);
    return def ? held(t.town, item) - safeQty(economy, def, t.town.specialties) : 0;
  };
  const fill = (item: string) => {
    const def = t.catalog.get(item);
    return def && tradeable(economy, def) ? held(t.town, item) / capacityOf(economy, def, t.town.specialties) : Infinity;
  };
  const level = facilityLevel(t.town, job);
  for (let b = chanceRound(t.rng, workers * t.cfg.townTick.craft.perWorker); b > 0; b--) {
    const can = t.recipes
      .filter((x) => x.facility === job && x.level <= level && x.inputs.every((i) => above(i.item) >= i.qty))
      .filter((x) => x.outputs.every((o) => fill(o.item) < 1))
      .sort((a, b2) => fill(a.outputs[0].item) - fill(b2.outputs[0].item));
    const recipe = can[0];
    if (!recipe) return;
    for (const i of recipe.inputs) takeOut(t.town, i.item, i.qty);
    for (const o of recipe.outputs) bringIn(t, o.item, o.qty);
    r.batches += 1;
  }
}

function takeOut(town: Town, item: string, qty: number): void {
  let left = qty;
  for (const row of [...town.stock.values()].filter((x) => x.item === item).sort((a, b) => b.qty - a.qty)) {
    const take = Math.min(left, row.qty);
    row.qty -= take;
    left -= take;
    if (left === 0) return;
  }
}

function capStock(t: TickInput): void {
  for (const row of t.town.stock.values()) {
    const def = t.catalog.get(row.item);
    if (!def) continue;
    row.qty = Math.min(row.qty, Math.floor(capacityOf(t.cfg.economy, def, t.town.specialties) * t.cfg.townTick.maxFill));
  }
}

export function townTick(t: TickInput): TickReport {
  const r: TickReport = { used: 0, paid: 0, wages: 0, caught: 0, logs: 0, batches: 0, hunted: [] };
  consume(t, r);
  const crafts = new Set(t.recipes.map((x) => x.facility));
  // Gatherers first, then craftsmen (so today's catch can be cooked today). Common jobs bring nothing to the store.
  const jobs = Object.keys(t.jobs)
    .filter((job) => GATHER_JOBS.includes(job) || crafts.has(job))
    .sort((a, b) => Number(!GATHER_JOBS.includes(a)) - Number(!GATHER_JOBS.includes(b)));
  for (const job of jobs) {
    const wage = t.cfg.townTick.wages[job] ?? 0;
    const workers = Math.min(workersIn(t, job), wage > 0 ? Math.floor(t.town.purse / wage) : Infinity); // the unpaid stay home
    if (workers <= 0) continue;
    const pay = Math.ceil(workers * wage);
    t.town.purse -= pay;
    r.wages += pay;
    if (job === 'hunter') hunt(t, workers, r);
    else if (job === 'woodcutter') cutWood(t, workers, r);
    else craft(t, job, workers, r);
  }
  capStock(t);
  return r;
}
