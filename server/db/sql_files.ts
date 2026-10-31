import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';

// Lists .sql files under dir (subfolders included), sorted by relative path.
export async function listSqlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();
}

// Applies each file once, in its own transaction, and records it in trackingTable.
export async function applySqlDir(
  pool: pg.Pool,
  dir: string,
  trackingTable: string,
): Promise<string[]> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${trackingTable} (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  const done = await pool.query<{ name: string }>(`SELECT name FROM ${trackingTable}`);
  const applied = new Set(done.rows.map((r) => r.name));
  const ran: string[] = [];

  for (const name of await listSqlFiles(dir)) {
    if (applied.has(name)) continue;
    const sql = await readFile(path.join(dir, name), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(`INSERT INTO ${trackingTable} (name) VALUES ($1)`, [name]);
      await client.query('COMMIT');
      ran.push(name);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`${name}: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
  return ran;
}
