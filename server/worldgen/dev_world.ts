import { loadBalance } from '../config/balance.ts';
import { inTransaction } from '../data/entity_save.ts';
import { createPool } from '../db/pool.ts';
import { createRng } from '../util/rng.ts';
import { loadBiomeSpecies } from './biome_species.ts';
import { loadCultures } from './cultures.ts';
import { planWorld } from './plan.ts';
import { writeWorld } from './worldgen_repo.ts';

// npm run world:dev -- [--seed N] [--towns 3]: rebuilds the dev round as a small world: 2 rings of hexes (19) that
// play as the outer two rings of the ladder (outer = the last ring, then the next; the middle hex one further in,
// with a vice). The towns stand on the outskirts, one per culture (human meadow, dwarf volcano, elf grove: each
// culture's first biome), then, past the cultures, in the outer ring's biomes with differing specialties. The old dev round ends (its players are summoned anew); an active round, if any, still wins.
// Restart the game server afterwards.

const opt = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? Number(process.argv[i + 1]) : null; };
const seed = opt('seed') ?? Math.floor(Math.random() * 2 ** 31);
const townCount = opt('towns') ?? 3;
const DEV_RINGS = 2;

const pool = createPool();
try {
  const cfg = await loadBalance(pool);
  const g = cfg.worldGen;
  const outer = cfg.rings.count;
  const shift = outer - DEV_RINGS; // distance d plays as ring d + shift
  const biomesOf = (ring: number) => g.biomes.get(ring) ?? {};
  const dev = {
    ...g,
    towns: new Map([[DEV_RINGS, townCount]]),
    biomes: new Map([[1, biomesOf(outer - 1)], [2, biomesOf(outer)]]),
    centreBiome: Object.entries(biomesOf(shift)).sort((a, b) => b[1] - a[1])[0]?.[0] ?? g.centreBiome,
  };
  const rng = createRng(seed);
  const plan = planWorld(dev, DEV_RINGS, rng);
  for (const h of plan.hexes) h.ring += shift;
  // Town biomes: one per culture first, then the outer ring's biomes, most common first, one per distinct specialty set.
  const picks: string[] = (await loadCultures(pool)).map((c) => c.biomes[0]).filter(Boolean);
  for (const [biome] of Object.entries(biomesOf(outer)).sort((a, b) => b[1] - a[1])) {
    const key = JSON.stringify([...(g.town.specialties[biome] ?? [])].sort());
    if (!picks.includes(biome) && !picks.some((p) => JSON.stringify([...(g.town.specialties[p] ?? [])].sort()) === key)) picks.push(biome);
  }
  plan.hexes.filter((h) => h.town).forEach((h, i) => { if (picks.length) h.biome = picks[i % picks.length]; });

  const species = await loadBiomeSpecies(pool);
  const roundId = await inTransaction(pool, (client) => writeWorld(client, cfg, plan, seed, species, rng, 'dev'));
  console.log(`dev round ${roundId} (seed ${seed}): ${plan.hexes.length} hexes, rings ${shift}-${outer}, ${plan.borders.length} borders`);
  const towns = await pool.query<{ q: number; r: number; ring: number; biome: string; culture: string | null; specialties: string[] }>(
    `SELECT h.q, h.r, h.ring, h.biome, t.culture, e.specialties FROM world.towns t JOIN world.hexes h ON h.id = t.hex_id
     JOIN world.town_economy e ON e.town_ref = t.id::text WHERE t.round_id = $1 ORDER BY h.q, h.r`, [roundId]);
  for (const t of towns.rows) console.log(`  town at ${t.q},${t.r} ring ${t.ring}: ${t.culture ?? 'no culture'} in ${t.biome} (${t.specialties.join(', ') || 'no specialty'})`);
} finally {
  await pool.end();
}
