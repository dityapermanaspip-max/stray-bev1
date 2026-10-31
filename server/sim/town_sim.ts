import { parseArgs } from 'node:util';
import { loadBalance } from '../config/balance.ts';
import { loadRecipes, loadTown, type Town } from '../data/economy_repo.ts';
import { devRoundId, loadFieldData } from '../data/field_repo.ts';
import { loadItemCatalog } from '../data/item_repo.ts';
import { loadLoot } from '../data/loot_repo.ts';
import { loadPopulation } from '../data/population_repo.ts';
import { createPool } from '../db/pool.ts';
import { capacityOf, safeQty, sellPrice } from '../economy/prices.ts';
import { createRng } from '../util/rng.ts';
import type { TickReport } from '../world/town_tick.ts';
import { runHour, type HexInfo, type TickTown, type TickWorld } from '../world/world_hour.ts';

// Dev report: the dev world's towns and hexes run N world hours from their current DB state (population rules and
// town ticks), in memory. Shows per day each town's purse, money in and out, and stock and price of sample goods.
// Reads the DB, writes nothing. npm run sim:town -- --days 7 [--items chicken_meat,grilled_chicken] [--seed 1]

const { values } = parseArgs({
  options: {
    days: { type: 'string', default: '7' }, seed: { type: 'string', default: '1' },
    items: { type: 'string', default: 'chicken_meat,grilled_chicken,lizard_meat,oak_log,tanned_leather,leather_jerkin' },
  },
});
const pool = createPool();
const cfg = await loadBalance(pool);
const roundId = await devRoundId(pool);
if (!roundId) throw new Error('no dev round: run npm run db:seed');
const [catalog, loot, recipes, fields] = await Promise.all([loadItemCatalog(pool), loadLoot(pool), loadRecipes(pool), loadFieldData(pool)]);
const hexes = (await pool.query<HexInfo>('SELECT id::text AS id, q, r, ring, biome FROM world.hexes WHERE round_id = $1', [roundId])).rows;
const pop = await loadPopulation(pool, hexes.map((h) => h.id));
const eco = await pool.query<{ town_ref: string; jobs: Record<string, number>; population: number }>('SELECT town_ref, jobs, population FROM world.town_economy WHERE town_ref = ANY($1)', [hexes.map((h) => h.id)]);
const towns: TickTown[] = [];
for (const e of eco.rows) {
  const town = await loadTown(pool, cfg.economy, catalog, e.town_ref);
  if (town) towns.push({ town, population: e.population, jobs: e.jobs });
}
await pool.end();

const w: TickWorld = { cfg, catalog, loot, recipes, biomes: fields.biomes, rng: createRng(Number(values.seed)) };
const items = String(values.items).split(',');
const held = (t: Town, item: string) => [...t.stock.values()].filter((r) => r.item === item).reduce((n, r) => n + r.qty, 0);
function goods(t: Town): string {
  return items.map((item) => {
    const def = catalog.get(item);
    if (!def) return `${item}?`;
    const cap = capacityOf(cfg.economy, def, t.specialties);
    const n = held(t, item);
    return `${item} ${n}/${cap} (safe ${safeQty(cfg.economy, def, t.specialties)}) @${sellPrice(cfg.economy, def, def.defaultQuality, n, cap)}`;
  }).join(' | ');
}
const natives = () => hexes.map((h) => `${h.q},${h.r}: ${(pop.get(h.id) ?? []).map((p) => `${p.species} ${p.natives}+${p.corrupted}c`).join(' ') || '-'}`).join('  ');

console.log(`day 0  purse ${towns.map((t) => t.town.purse).join(', ')}\n  ${towns.map((t) => goods(t.town)).join('\n  ')}\n  ${natives()}`);
let hour = 0;
for (let day = 1; day <= Number(values.days); day++) {
  const sum = new Map<string, TickReport>();
  for (let h = 0; h < 24; h++) {
    for (const [ref, r] of runHour(w, hexes, pop, towns, ++hour)) {
      const s = sum.get(ref) ?? { used: 0, paid: 0, wages: 0, caught: 0, logs: 0, batches: 0, hunted: [] };
      for (const k of ['used', 'paid', 'wages', 'caught', 'logs', 'batches'] as const) s[k] += r[k];
      sum.set(ref, s);
    }
  }
  for (const { town } of towns) {
    const s = sum.get(town.ref);
    console.log(`day ${day}  purse ${town.purse} (in ${s?.paid ?? 0}, wages ${s?.wages ?? 0}) used ${s?.used ?? 0} caught ${s?.caught ?? 0} logs ${s?.logs ?? 0} batches ${s?.batches ?? 0}`);
    console.log(`  ${goods(town)}`);
  }
  console.log(`  ${natives()}`);
}
