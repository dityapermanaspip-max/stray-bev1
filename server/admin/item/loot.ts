import type pg from 'pg';

// Admin loot editor: loot tables (made with their species, vice or boss) and their entries.
// Chances are per-mille (1-1000), as the table check enforces.

export type LootEntry = { item: string; chance: number; min: number; max: number };
export type LootTable = { name: string; owner: string; entries: LootEntry[] };

export async function listLoot(pool: pg.Pool): Promise<LootTable[]> {
  const res = await pool.query<LootTable>(
    `SELECT t.table_name AS name, t.owner,
       COALESCE((SELECT json_agg(json_build_object('item', i.item_name, 'chance', e.chance_permille, 'min', e.min_qty, 'max', e.max_qty)
                 ORDER BY i.item_name)
                 FROM item.loot_entries e JOIN item.items i ON i.id = e.item_id WHERE e.loot_table_id = t.id), '[]') AS entries
     FROM item.loot_tables t ORDER BY t.owner, t.table_name`,
  );
  return res.rows;
}

export async function setLootEntry(pool: pg.Pool, table: string, item: string, chance: number, min: number, max: number): Promise<string | null> {
  if (!Number.isInteger(chance) || chance < 1 || chance > 1000) return 'chance must be a whole number, 1 to 1000 (per-mille)';
  if (!Number.isInteger(min) || min < 1) return 'min must be a whole number of 1 or more';
  if (!Number.isInteger(max) || max < min) return 'max must be a whole number, not below min';
  const res = await pool.query(
    `INSERT INTO item.loot_entries (loot_table_id, item_id, chance_permille, min_qty, max_qty)
     SELECT t.id, i.id, $3, $4, $5 FROM item.loot_tables t, item.items i WHERE t.table_name = $1 AND i.item_name = $2
     ON CONFLICT (loot_table_id, item_id) DO UPDATE SET chance_permille = EXCLUDED.chance_permille, min_qty = EXCLUDED.min_qty, max_qty = EXCLUDED.max_qty`,
    [table, item, chance, min, max],
  );
  return res.rowCount ? null : 'unknown loot table or item';
}

export async function removeLootEntry(pool: pg.Pool, table: string, item: string): Promise<string | null> {
  const res = await pool.query(
    `DELETE FROM item.loot_entries e USING item.loot_tables t, item.items i
     WHERE e.loot_table_id = t.id AND e.item_id = i.id AND t.table_name = $1 AND i.item_name = $2`, [table, item],
  );
  return res.rowCount ? null : 'no such entry';
}
