import type pg from 'pg';
import { startQty, tradeable } from '../economy/prices.ts';
import type { EconomyConfig } from '../config/balance.ts';
import { stackKey, type Inventory } from '../inventory/bag.ts';
import type { ItemCatalog } from '../inventory/items.ts';
import { inTransaction } from './entity_save.ts';
import { writeInventory } from './item_repo.ts';

// Town purses, stock counts and craftsman levels (world.town_economy, world.town_stock), and recipes (item.recipes).

export type StockRow = { item: string; quality: string; qty: number };
export type Town = {
  ref: string; purse: number; maxBuy: number; specialties: string[];
  facilities: Record<string, number>; // craftsman service -> level (missing = 1)
  stock: Map<string, StockRow>;
};
export type ItemQty = { item: string; qty: number };
export type Recipe = { name: string; facility: string; level: number; inputs: ItemQty[]; outputs: ItemQty[] };

export const facilityLevel = (town: Town | null, facility: string) => town?.facilities[facility] ?? 1;

// One town's economy, or null when the field is not a trading town. Any tradeable item the town has no row for
// (a new town, or an item added since) is filled from config (start fill, more for its specialties) and written.
export async function loadTown(pool: pg.Pool, cfg: EconomyConfig, catalog: ItemCatalog, ref: string): Promise<Town | null> {
  const eco = await pool.query<{ purse: number; max_buy: number; specialties: string[]; facilities: Record<string, number> }>(
    'SELECT purse, max_buy, specialties, facilities FROM world.town_economy WHERE town_ref = $1', [ref],
  );
  const row = eco.rows[0];
  if (!row) return null;
  const town: Town = { ref, purse: row.purse, maxBuy: row.max_buy, specialties: row.specialties, facilities: row.facilities, stock: new Map() };
  const stock = await pool.query<{ item_name: string; quality: string; qty: number }>(
    `SELECT i.item_name, s.quality, s.qty FROM world.town_stock s JOIN item.items i ON i.id = s.item_id WHERE s.town_ref = $1`, [ref],
  );
  for (const s of stock.rows) town.stock.set(stackKey(s.item_name, s.quality), { item: s.item_name, quality: s.quality, qty: s.qty });
  const known = new Set(stock.rows.map((s) => s.item_name));
  const fill: StockRow[] = [];
  for (const def of catalog.values()) {
    if (known.has(def.name) || !tradeable(cfg, def)) continue;
    const r = { item: def.name, quality: def.defaultQuality, qty: startQty(cfg, def, town.specialties) };
    town.stock.set(stackKey(r.item, r.quality), r);
    fill.push(r);
  }
  if (fill.length > 0) await inTransaction(pool, (client) => fillStock(client, ref, fill));
  return town;
}

async function fillStock(client: pg.PoolClient, ref: string, rows: StockRow[]): Promise<void> {
  await client.query(
    `INSERT INTO world.town_stock (town_ref, item_id, quality, qty)
     SELECT $1, i.id, x.quality, x.qty FROM unnest($2::text[], $3::text[], $4::int[]) AS x(item, quality, qty)
     JOIN item.items i ON i.item_name = x.item
     ON CONFLICT (town_ref, item_id, quality) DO NOTHING`,
    [ref, rows.map((r) => r.item), rows.map((r) => r.quality), rows.map((r) => Math.max(0, r.qty))],
  );
}

// A trade or a craft fee, at once: the player's bag, the town's stock changes (qty as +/- deltas), and its purse.
// Stock and purse move by deltas and may never go below zero (another player may have emptied a shelf or the till).
export async function saveTrade(pool: pg.Pool, entityId: string, inv: Inventory, ref: string, deltas: StockRow[], purseDelta: number): Promise<void> {
  await inTransaction(pool, async (client) => {
    await writeInventory(client, entityId, inv);
    for (const d of deltas) {
      const args = [ref, d.item, d.quality, d.qty];
      let res = await client.query(
        `UPDATE world.town_stock s SET qty = s.qty + $4 FROM item.items i
         WHERE s.town_ref = $1 AND s.item_id = i.id AND i.item_name = $2 AND s.quality = $3 AND s.qty + $4 >= 0`, args,
      );
      if (res.rowCount === 0 && d.qty > 0) {
        res = await client.query(
          'INSERT INTO world.town_stock (town_ref, item_id, quality, qty) SELECT $1, i.id, $3, $4 FROM item.items i WHERE i.item_name = $2', args,
        );
      }
      if (res.rowCount !== 1) throw new Error('town_stock');
    }
    const res = await client.query('UPDATE world.town_economy SET purse = purse + $2 WHERE town_ref = $1 AND purse + $2 >= 0', [ref, purseDelta]);
    if (res.rowCount !== 1) throw new Error('town_purse');
  });
}

const itemQtys = (xs: unknown): ItemQty[] =>
  Array.isArray(xs) ? xs.map((x: { item?: unknown; qty?: unknown }) => ({ item: String(x?.item ?? ''), qty: Number(x?.qty) })) : [];

export async function loadRecipes(pool: pg.Pool): Promise<Recipe[]> {
  const res = await pool.query<{ recipe_name: string; facility_type: string; min_facility_level: number; inputs: unknown; outputs: unknown }>(
    'SELECT recipe_name, facility_type, min_facility_level, inputs, outputs FROM item.recipes ORDER BY facility_type, recipe_name',
  );
  return res.rows.map((r) => ({
    name: r.recipe_name, facility: r.facility_type, level: r.min_facility_level, inputs: itemQtys(r.inputs), outputs: itemQtys(r.outputs),
  }));
}
