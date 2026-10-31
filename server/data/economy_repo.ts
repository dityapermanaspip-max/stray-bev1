import type pg from 'pg';
import { startQty, tradeable } from '../economy/prices.ts';
import type { EconomyConfig } from '../config/balance.ts';
import { stackKey, type Inventory } from '../inventory/bag.ts';
import type { ItemCatalog } from '../inventory/items.ts';
import { inTransaction } from './entity_save.ts';
import { writeInventory } from './item_repo.ts';

// Town purses, stock counts and craft recipes (world.town_economy, world.town_stock, item.crafts).

export type StockRow = { item: string; quality: string; qty: number };
export type Town = { ref: string; purse: number; maxBuy: number; specialties: string[]; stock: Map<string, StockRow> };
export type Craft = { name: string; craftsman: string; output: string; outputQty: number; inputs: { item: string; qty: number }[] };

// One town's economy, or null when the field is not a trading town. A town with no stock yet is filled
// from config (start fill per item, more for its specialties) and written back.
export async function loadTown(pool: pg.Pool, cfg: EconomyConfig, catalog: ItemCatalog, ref: string): Promise<Town | null> {
  const eco = await pool.query<{ purse: number; max_buy: number; specialties: string[] }>(
    'SELECT purse, max_buy, specialties FROM world.town_economy WHERE town_ref = $1', [ref],
  );
  const row = eco.rows[0];
  if (!row) return null;
  const town: Town = { ref, purse: row.purse, maxBuy: row.max_buy, specialties: row.specialties, stock: new Map() };
  const stock = await pool.query<{ item_name: string; quality: string; qty: number }>(
    `SELECT i.item_name, s.quality, s.qty FROM world.town_stock s JOIN item.items i ON i.id = s.item_id WHERE s.town_ref = $1`, [ref],
  );
  for (const s of stock.rows) town.stock.set(stackKey(s.item_name, s.quality), { item: s.item_name, quality: s.quality, qty: s.qty });
  if (town.stock.size > 0) return town;
  for (const def of catalog.values()) {
    if (!tradeable(cfg, def)) continue;
    const qty = startQty(cfg, def, town.specialties);
    town.stock.set(stackKey(def.name, def.defaultQuality), { item: def.name, quality: def.defaultQuality, qty });
  }
  await inTransaction(pool, (client) => writeStock(client, ref, [...town.stock.values()]));
  return town;
}

async function writeStock(client: pg.PoolClient, ref: string, rows: StockRow[]): Promise<void> {
  await client.query(
    `INSERT INTO world.town_stock (town_ref, item_id, quality, qty)
     SELECT $1, i.id, x.quality, x.qty FROM unnest($2::text[], $3::text[], $4::int[]) AS x(item, quality, qty)
     JOIN item.items i ON i.item_name = x.item
     ON CONFLICT (town_ref, item_id, quality) DO UPDATE SET qty = EXCLUDED.qty`,
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

export async function loadCrafts(pool: pg.Pool): Promise<Craft[]> {
  const res = await pool.query<{ craft_name: string; craftsman: string; item_name: string; output_qty: number; inputs: { item: string; qty: number }[] }>(
    `SELECT c.craft_name, c.craftsman, i.item_name, c.output_qty, c.inputs
     FROM item.crafts c JOIN item.items i ON i.id = c.output_item_id ORDER BY c.craftsman, c.craft_name`,
  );
  return res.rows.map((r) => ({
    name: r.craft_name, craftsman: r.craftsman, output: r.item_name, outputQty: r.output_qty,
    inputs: r.inputs.map((x) => ({ item: String(x.item), qty: Number(x.qty) })),
  }));
}
