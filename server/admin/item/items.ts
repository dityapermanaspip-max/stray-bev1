import type pg from 'pg';

// Admin item editor: list items, save one (create, or update type and data of an existing one). The display name
// is the one `item_name_<item>` line. Shape and core material of an existing item are never changed here.

export const ITEM_TYPES = ['scroll', 'potion', 'material', 'weapon', 'armor', 'accessory', 'clothing', 'ammo', 'food', 'coin', 'tool', 'carcass', 'part', 'essence'];
const NAME = /^[a-z][a-z0-9_]{1,60}$/;

export type ItemRow = { name: string; type: string; display: string; data: unknown };
export type ItemDraft = { name: string; type: string; display: string; data: unknown; create: boolean };

export async function listItems(pool: pg.Pool, q: string, type: string): Promise<ItemRow[]> {
  const res = await pool.query<ItemRow>(
    `SELECT i.item_name AS name, i.type, i.data,
       COALESCE((SELECT l.text FROM presentation.diegetic_lines l WHERE l.condition_key = 'item_name_' || i.item_name LIMIT 1), '') AS display
     FROM item.items i
     WHERE ($1 = '' OR i.item_name ILIKE '%' || $1 || '%') AND ($2 = '' OR i.type = $2)
     ORDER BY i.type, i.item_name LIMIT 300`, [q, type],
  );
  return res.rows;
}

export async function saveItem(pool: pg.Pool, d: ItemDraft): Promise<string | null> {
  if (!NAME.test(String(d.name ?? ''))) return 'name: lowercase letters, digits and _ (2-61 chars)';
  if (!ITEM_TYPES.includes(d.type)) return `type must be one of ${ITEM_TYPES.join(', ')}`;
  if (!d.data || typeof d.data !== 'object' || Array.isArray(d.data)) return 'data must be a JSON object';
  const display = String(d.display ?? '').trim();
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const exists = (await c.query('SELECT 1 FROM item.items WHERE item_name = $1', [d.name])).rowCount;
    if (d.create && exists) { await c.query('ROLLBACK'); return `item ${d.name} already exists`; }
    if (!d.create && !exists) { await c.query('ROLLBACK'); return `item ${d.name} does not exist`; }
    if (d.create && !display) { await c.query('ROLLBACK'); return 'display name is required for a new item'; }
    if (d.create) await c.query('INSERT INTO item.items (item_name, type, data) VALUES ($1, $2, $3)', [d.name, d.type, JSON.stringify(d.data)]);
    else await c.query('UPDATE item.items SET type = $2, data = $3 WHERE item_name = $1', [d.name, d.type, JSON.stringify(d.data)]);
    if (display) {
      const key = `item_name_${d.name}`;
      await c.query('DELETE FROM presentation.diegetic_lines WHERE condition_key = $1', [key]);
      await c.query(
        `INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
         SELECT $1, 0, s.id, 'neutral', $2 FROM presentation.speakers s WHERE s.speaker_name = 'generic'`, [key, display],
      );
    }
    await c.query('COMMIT');
    return null;
  } catch (err) {
    await c.query('ROLLBACK');
    return (err as Error).message;
  } finally {
    c.release();
  }
}
