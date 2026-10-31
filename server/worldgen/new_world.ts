import { loadBalance } from '../config/balance.ts';
import { inTransaction } from '../data/entity_save.ts';
import { createPool } from '../db/pool.ts';
import { createRng } from '../util/rng.ts';
import { planWorld } from './plan.ts';
import { writeWorld } from './worldgen_repo.ts';

// npm run world:new -- [--seed N]: makes a new active round (the old one ends). Dev and admin only.
// Players of the old round are placed at a stray summon point of the new one when they next join.
// Restart the game server afterwards: it loads the round's links at start.

const arg = process.argv.indexOf('--seed');
const seed = arg >= 0 ? Number(process.argv[arg + 1]) : Math.floor(Math.random() * 2 ** 31);
if (!Number.isInteger(seed)) throw new Error('--seed needs a whole number');

const pool = createPool();
try {
  const cfg = await loadBalance(pool);
  const species = (await pool.query<{ id: string; ring_min: number; ring_max: number }>('SELECT id::text, ring_min, ring_max FROM entity.species')).rows
    .map((s) => ({ id: s.id, ringMin: s.ring_min, ringMax: s.ring_max }));
  const rng = createRng(seed);
  const plan = planWorld(cfg.worldGen, cfg.rings.count, rng);
  const roundId = await inTransaction(pool, (client) => writeWorld(client, cfg, plan, seed, species, rng));
  const biomes = new Map<string, number>();
  for (const h of plan.hexes) biomes.set(h.biome, (biomes.get(h.biome) ?? 0) + 1);
  const corridors = plan.borders.reduce((n, b) => n + b.corridors.length, 0);
  console.log(`round ${roundId} (seed ${seed}): ${plan.hexes.length} hexes, ${plan.borders.length} borders, ${corridors} corridors`);
  console.log(`towns per ring: ${[...new Set(plan.hexes.map((h) => h.ring))].map((r) => `${r}:${plan.hexes.filter((h) => h.ring === r && h.town).length}`).join(' ')}`);
  console.log(`biomes: ${[...biomes].map(([b, n]) => `${b} ${n}`).join(', ')}`);
} finally {
  await pool.end();
}
