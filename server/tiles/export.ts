import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createPool } from '../db/pool.ts';
import { loadTiles } from './tile_repo.ts';

// npm run tiles:export: writes the catalog for the client (stray-fev2 tiles:catalog slices the art from it, the game
// reads it to pick a drawing per tile). The DB stays the truth; the file is made from it.
// Also writes captions.json beside it (tile key -> description) for the art tools; the game never reads it.
const out = process.argv[2] ?? path.resolve(import.meta.dirname, '../../../stray-fev2/public/assets/world/tiles/catalog/catalog.json');
const pool = createPool();
try {
  const tiles = await loadTiles(pool);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify({ tiles }, null, 1) + '\n');
  const { rows } = await pool.query<{ key: string; description: string | null }>('SELECT tile_key AS key, description FROM world.tiles ORDER BY tile_key');
  await writeFile(path.join(path.dirname(out), 'captions.json'), JSON.stringify(Object.fromEntries(rows.map((r) => [r.key, r.description ?? ''])), null, 1) + '\n');
  console.log(`${tiles.length} tiles -> ${out}`);
} finally {
  await pool.end();
}
