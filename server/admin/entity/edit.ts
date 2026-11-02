import type pg from 'pg';
import { STATS } from '../../stats/derived.ts';

// Admin edits on one entity. Stat exp is never touched here (only the move level-up function adds it).
// Each returns an error text, or null when it worked.

const SANE_MAX = 999; // input guard for the admin form, not a balance number

export async function renameEntity(pool: pg.Pool, id: string, name: string): Promise<string | null> {
  const clean = name.trim();
  if (clean.length < 1 || clean.length > 40) return 'name must be 1 to 40 characters';
  const res = await pool.query('UPDATE entity.entities SET name = $2 WHERE id = $1', [id, clean]);
  return res.rowCount ? null : 'unknown entity';
}

export async function setBaseStat(pool: pg.Pool, id: string, stat: string, base: number): Promise<string | null> {
  if (!(STATS as readonly string[]).includes(stat)) return `unknown stat ${stat}`;
  if (!Number.isFinite(base) || base < 1 || base > SANE_MAX) return `base must be 1 to ${SANE_MAX}`;
  const res = await pool.query('UPDATE entity.entity_stats SET base = $3 WHERE entity_id = $1 AND stat = $2', [id, stat, base]);
  return res.rowCount ? null : 'entity has no such stat row';
}

// Adds a move, or sets the level of a known one. Exp stays as it was (0 for a new move).
export async function setKnownMove(pool: pg.Pool, id: string, move: string, level: number): Promise<string | null> {
  if (!Number.isInteger(level) || level < 1 || level > SANE_MAX) return `level must be a whole number, 1 to ${SANE_MAX}`;
  const res = await pool.query(
    `INSERT INTO entity.known_moves (entity_id, move_id, level, seen)
     SELECT $1, m.id, $3, true FROM moves.moves m WHERE m.move_name = $2
     ON CONFLICT (entity_id, move_id) DO UPDATE SET level = EXCLUDED.level`,
    [id, move, level],
  );
  return res.rowCount ? null : `unknown move ${move}`;
}

// Forgets a move and frees its loadout slot.
export async function removeKnownMove(pool: pg.Pool, id: string, move: string): Promise<string | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ids = `(SELECT id FROM moves.moves WHERE move_name = $2)`;
    await client.query(`DELETE FROM entity.loadouts WHERE entity_id = $1 AND move_id IN ${ids}`, [id, move]);
    const res = await client.query(`DELETE FROM entity.known_moves WHERE entity_id = $1 AND move_id IN ${ids}`, [id, move]);
    await client.query('COMMIT');
    return res.rowCount ? null : 'entity does not know that move';
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
