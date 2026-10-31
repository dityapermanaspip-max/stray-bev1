import path from 'node:path';
import { createPool } from './pool.ts';
import { applySqlDir } from './sql_files.ts';

const dir = path.resolve(import.meta.dirname, '../../db/seeds');
const pool = createPool();

try {
  const ran = await applySqlDir(pool, dir, 'public.seed_runs');
  console.log(ran.length ? `Applied seeds:\n  ${ran.join('\n  ')}` : 'Seeds up to date.');
} catch (err) {
  console.error(`Seed failed: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
