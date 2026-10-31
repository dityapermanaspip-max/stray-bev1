import type pg from 'pg';
import type { GatherConfig } from '../config/gather_config.ts';
import type { LootEntry } from '../inventory/loot.ts';

// Node finds (loot tables owned by 'node') and how much of each node has been taken. Shared by every player:
// a take is one statement that only passes while the node has uses left.

export async function loadNodeLoot(pool: pg.Pool): Promise<Map<string, LootEntry[]>> {
  const rows = (await pool.query<{ table_name: string; item_name: string; chance_permille: number; min_qty: number; max_qty: number }>(
    `SELECT t.table_name, i.item_name, e.chance_permille, e.min_qty, e.max_qty
     FROM item.loot_tables t JOIN item.loot_entries e ON e.loot_table_id = t.id JOIN item.items i ON i.id = e.item_id
     WHERE t.owner = 'node' ORDER BY t.table_name, i.item_name`,
  )).rows;
  const tables = new Map<string, LootEntry[]>();
  for (const r of rows) {
    const list = tables.get(r.table_name) ?? [];
    list.push({ item: r.item_name, permille: r.chance_permille, min: r.min_qty, max: r.max_qty });
    tables.set(r.table_name, list);
  }
  return tables;
}

export const nodeTable = (kind: string, dark: boolean) => `node_${kind}_${dark ? 'corrupted' : 'native'}`;

// One use of a node, if it has any left. False when it is spent.
export async function takeNode(client: pg.PoolClient, ref: string, node: number, kind: string, uses: number): Promise<boolean> {
  const res = await client.query(
    `INSERT INTO world.field_nodes (field_ref, node, kind, taken) VALUES ($1, $2, $3, 1)
     ON CONFLICT (field_ref, node) DO UPDATE SET taken = world.field_nodes.taken + 1 WHERE world.field_nodes.taken < $4
     RETURNING taken`,
    [ref, node, kind, uses],
  );
  return (res.rowCount ?? 0) > 0;
}

// World tick: every node kind gets refill_per_hour uses back; fully grown back nodes leave the table.
export async function refillNodes(client: pg.PoolClient, cfg: GatherConfig): Promise<void> {
  const kinds = Object.entries(cfg.kinds);
  await client.query(
    `UPDATE world.field_nodes n SET taken = greatest(0, n.taken - x.refill)
     FROM unnest($1::text[], $2::int[]) AS x(kind, refill) WHERE n.kind = x.kind`,
    [kinds.map(([k]) => k), kinds.map(([, v]) => v.refillPerHour)],
  );
  await client.query('DELETE FROM world.field_nodes WHERE taken = 0');
}
