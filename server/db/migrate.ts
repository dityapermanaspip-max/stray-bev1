import path from 'node:path';
import { createPool } from './pool.ts';
import { applySqlDir } from './sql_files.ts';

const dir = path.resolve(import.meta.dirname, '../../db/migrations');
const pool = createPool();

try {
  const ran = await applySqlDir(pool, dir, 'public.schema_migrations');
  console.log(ran.length ? `Applied migrations:\n  ${ran.join('\n  ')}` : 'Migrations up to date.');
} catch (err) {
  console.error(`Migration failed: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
