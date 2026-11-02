import type pg from 'pg';

// Admin recipe editor. inputs and outputs are [{item, qty}] by item name; requires are [{move, level}] (all must pass).

type Line = { item: string; qty: number };
export type RecipeDraft = {
  name: string; facility: string; level: number; inputs: Line[]; outputs: Line[]; requires: { move: string; level: number }[]; create: boolean;
};
const NAME = /^[a-z][a-z0-9_]{1,60}$/;

export async function listRecipes(pool: pg.Pool) {
  const res = await pool.query(
    `SELECT r.recipe_name AS name, r.facility_type AS facility, r.min_facility_level AS level, r.inputs, r.outputs,
       COALESCE((SELECT json_agg(json_build_object('move', m.move_name, 'level', q.min_skill_level) ORDER BY m.move_name)
                 FROM item.recipe_requires q JOIN moves.moves m ON m.id = q.skill_move_id WHERE q.recipe_id = r.id), '[]') AS requires
     FROM item.recipes r ORDER BY r.facility_type, r.recipe_name`,
  );
  return res.rows;
}

async function lineProblems(c: pg.PoolClient, what: string, lines: Line[]): Promise<string | null> {
  if (!Array.isArray(lines) || lines.length === 0) return `${what} needs at least one line`;
  for (const l of lines) {
    if (!Number.isInteger(l.qty) || l.qty < 1) return `${what} ${l.item}: qty must be a whole number of 1 or more`;
    if (!(await c.query('SELECT 1 FROM item.items WHERE item_name = $1', [l.item])).rowCount) return `${what}: unknown item ${l.item}`;
  }
  return null;
}

export async function saveRecipe(pool: pg.Pool, d: RecipeDraft): Promise<string | null> {
  if (!NAME.test(String(d.name ?? ''))) return 'name: lowercase letters, digits and _ (2-61 chars)';
  if (!String(d.facility ?? '').trim()) return 'facility is required';
  if (!Number.isInteger(d.level) || d.level < 1) return 'level must be a whole number of 1 or more';
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const bad = (await lineProblems(c, 'inputs', d.inputs)) ?? (await lineProblems(c, 'outputs', d.outputs));
    if (bad) { await c.query('ROLLBACK'); return bad; }
    const old = (await c.query<{ id: string }>('SELECT id FROM item.recipes WHERE recipe_name = $1', [d.name])).rows[0]?.id;
    if (d.create && old) { await c.query('ROLLBACK'); return `recipe ${d.name} already exists`; }
    if (!d.create && !old) { await c.query('ROLLBACK'); return `recipe ${d.name} does not exist`; }
    const args = [d.name, d.facility.trim(), d.level, JSON.stringify(d.inputs), JSON.stringify(d.outputs)];
    const id = old
      ? (await c.query<{ id: string }>('UPDATE item.recipes SET facility_type = $2, min_facility_level = $3, inputs = $4, outputs = $5 WHERE recipe_name = $1 RETURNING id', args)).rows[0].id
      : (await c.query<{ id: string }>('INSERT INTO item.recipes (recipe_name, facility_type, min_facility_level, inputs, outputs) VALUES ($1,$2,$3,$4,$5) RETURNING id', args)).rows[0].id;
    await c.query('DELETE FROM item.recipe_requires WHERE recipe_id = $1', [id]);
    for (const r of d.requires ?? []) {
      if (!Number.isInteger(r.level) || r.level < 1) { await c.query('ROLLBACK'); return `requires ${r.move}: level must be a whole number of 1 or more`; }
      const ok = await c.query(
        'INSERT INTO item.recipe_requires (recipe_id, skill_move_id, min_skill_level) SELECT $1, m.id, $3 FROM moves.moves m WHERE m.move_name = $2', [id, r.move, r.level],
      );
      if (!ok.rowCount) { await c.query('ROLLBACK'); return `requires: unknown move ${r.move}`; }
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

export async function removeRecipe(pool: pg.Pool, name: string): Promise<string | null> {
  try {
    const res = await pool.query('DELETE FROM item.recipes WHERE recipe_name = $1', [name]);
    return res.rowCount ? null : 'unknown recipe';
  } catch (err) {
    return `cannot delete: ${(err as Error).message}`; // e.g. a player knows it
  }
}
