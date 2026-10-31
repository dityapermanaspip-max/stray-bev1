import type pg from 'pg';

// Where an entity stands: field (hex or corridor id) and tile. Written on stop, travel, leave and disconnect.

export type Position = { fieldRef: string; x: number; y: number };

export async function loadPosition(pool: pg.Pool, entityId: string): Promise<Position | null> {
  const res = await pool.query<{ field_ref: string; x: number; y: number }>(
    'SELECT field_ref, x, y FROM world.entity_positions WHERE entity_id = $1',
    [entityId],
  );
  const row = res.rows[0];
  return row ? { fieldRef: row.field_ref, x: row.x, y: row.y } : null;
}

export async function savePosition(pool: pg.Pool | pg.PoolClient, entityId: string, p: Position): Promise<void> {
  await pool.query(
    `INSERT INTO world.entity_positions (entity_id, field_ref, x, y) VALUES ($1, $2, $3, $4)
     ON CONFLICT (entity_id) DO UPDATE SET field_ref = EXCLUDED.field_ref, x = EXCLUDED.x, y = EXCLUDED.y, updated_at = now()`,
    [entityId, p.fieldRef, p.x, p.y],
  );
}

// The last town entered: where a passed-out player wakes.
export async function loadWake(pool: pg.Pool | pg.PoolClient, entityId: string): Promise<string | null> {
  const res = await pool.query<{ wake_ref: string | null }>('SELECT wake_ref FROM world.entity_positions WHERE entity_id = $1', [entityId]);
  return res.rows[0]?.wake_ref ?? null;
}

export async function saveWake(pool: pg.Pool, entityId: string, wakeRef: string): Promise<void> {
  await pool.query('UPDATE world.entity_positions SET wake_ref = $2 WHERE entity_id = $1', [entityId, wakeRef]);
}
