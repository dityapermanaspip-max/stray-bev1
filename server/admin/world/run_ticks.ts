import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { loadLoot } from '../../data/loot_repo.ts';
import { readClock, runWorldHour, type TickWorld } from '../../data/tick_repo.ts';
import { createPool } from '../../db/pool.ts';
import { loadGameWorld } from '../../game/world.ts';
import { createRng } from '../../util/rng.ts';

// Admin command: run N world hours on the current round now (population rules, invasions, town ticks), each in its
// own transaction, moving the round's clock with them. The real-time clock (tick_at) is left alone, so the game
// server's ticker carries on from the new hour. Hidden numbers stay on the server console.

export type TickRun = { from: number; to: number; towns: number };

export async function runTicks(pool: pg.Pool, hours: number, seed = Date.now() >>> 0): Promise<TickRun> {
  const world = await loadGameWorld(pool);
  const w: TickWorld = {
    cfg: world.data.cfg, catalog: world.catalog, loot: await loadLoot(pool), recipes: world.recipes, biomes: world.fields.biomes, rng: createRng(seed),
  };
  const start = (await readClock(pool, world.roundId)).hours;
  let towns = 0;
  for (let h = start + 1; h <= start + hours; h++) towns += (await runWorldHour(pool, w, world.roundId, h)).size;
  return { from: start, to: (await readClock(pool, world.roundId)).hours, towns };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf('--hours');
  const hours = Number(at > 0 ? process.argv[at + 1] : NaN);
  if (!Number.isInteger(hours) || hours < 1 || hours > 24 * 365) {
    console.error('usage: npm run world:ticks -- --hours N (1 to 8760)');
    process.exitCode = 1;
  } else {
    const pool = createPool();
    try {
      const run = await runTicks(pool, hours);
      console.log(`World clock ${run.from} -> ${run.to} (${run.towns} town ticks). Open fields read fresh counts when someone joins.`);
    } finally {
      await pool.end();
    }
  }
}
