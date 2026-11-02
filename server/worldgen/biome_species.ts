import type pg from 'pg';
import type { BiomeSpecies } from './worldgen_repo.ts';

// Who lives in each biome (world.biome_species), for world generation and the admin populate.
export async function loadBiomeSpecies(pool: pg.Pool | pg.PoolClient): Promise<BiomeSpecies> {
  const res = await pool.query<{ biome: string; id: string; weight: number; born: boolean }>(
    `SELECT b.biome_name AS biome, bs.species_id::text AS id, bs.weight, s.born_corrupted AS born
     FROM world.biome_species bs JOIN world.biomes b ON b.id = bs.biome_id JOIN entity.species s ON s.id = bs.species_id ORDER BY 1, 2`,
  );
  const out: BiomeSpecies = new Map();
  for (const r of res.rows) out.set(r.biome, [...(out.get(r.biome) ?? []), { id: r.id, weight: r.weight, bornCorrupted: r.born }]);
  return out;
}
