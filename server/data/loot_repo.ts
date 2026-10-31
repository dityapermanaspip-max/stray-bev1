import type pg from 'pg';
import type { CarcassData, LootData, LootEntry, SpeciesLoot } from '../inventory/loot.ts';

// Species loot tables (natural and corrupted), essence tiers, and field corpses.

export async function loadLoot(pool: pg.Pool): Promise<LootData> {
  const [entries, tiers] = await Promise.all([
    pool.query<{ species_name: string; corrupted: boolean; item_name: string; chance_permille: number; min_qty: number; max_qty: number }>(
      `SELECT s.species_name, (t.id = s.loot_table_corrupted) AS corrupted, i.item_name, e.chance_permille, e.min_qty, e.max_qty
       FROM entity.species s
       JOIN item.loot_tables t ON t.id IN (s.loot_table_native, s.loot_table_corrupted)
       JOIN item.loot_entries e ON e.loot_table_id = t.id
       JOIN item.items i ON i.id = e.item_id
       ORDER BY s.species_name, i.item_name`,
    ),
    pool.query<{ tier: string; min_total_stats: number; item_name: string }>(
      `SELECT et.tier, et.min_total_stats, i.item_name
       FROM item.essence_tiers et JOIN item.items i ON i.id = et.item_id
       ORDER BY et.min_total_stats`,
    ),
  ]);
  const bySpecies = new Map<string, SpeciesLoot>();
  for (const r of entries.rows) {
    const loot = bySpecies.get(r.species_name) ?? { native: [], corrupted: [] };
    const entry: LootEntry = { item: r.item_name, permille: r.chance_permille, min: r.min_qty, max: r.max_qty };
    (r.corrupted ? loot.corrupted : loot.native).push(entry);
    bySpecies.set(r.species_name, loot);
  }
  return {
    bySpecies,
    essence: tiers.rows.map((t) => ({ quality: t.tier, minTotal: t.min_total_stats, item: t.item_name })),
  };
}

// A carcass nobody could carry stays on the field. Rot comes from killed_at.
export async function insertCorpses(client: pg.PoolClient | pg.Pool, fieldRef: string, corpses: CarcassData[]): Promise<void> {
  for (const c of corpses) {
    await client.query(
      `INSERT INTO world.corpses (field_ref, species_id, corrupted, total_stats, killed_at)
       SELECT $1, s.id, $3, $4, to_timestamp($5 / 1000.0) FROM entity.species s WHERE s.species_name = $2`,
      [fieldRef, c.species, c.corrupted, c.totalStats, c.killedAt],
    );
  }
}
