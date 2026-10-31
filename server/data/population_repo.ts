import type pg from 'pg';
import type { PopRow } from '../world/population.ts';

// Creature counts per species for hex fields (world.field_population). Hidden: server only.

export async function loadPopulation(pool: pg.Pool, fieldRefs: string[]): Promise<Map<string, PopRow[]>> {
  const res = await pool.query<{ field_ref: string; species_name: string; natural_count: number; corrupted_count: number; safe_count: number; max_count: number }>(
    `SELECT p.field_ref, s.species_name, p.natural_count, p.corrupted_count, p.safe_count, p.max_count
     FROM world.field_population p JOIN entity.species s ON s.id = p.species_id
     WHERE p.field_ref = ANY($1) ORDER BY s.species_name`,
    [fieldRefs],
  );
  const out = new Map<string, PopRow[]>(fieldRefs.map((ref) => [ref, []]));
  for (const r of res.rows) {
    out.get(r.field_ref)!.push({
      species: r.species_name, natives: Number(r.natural_count), corrupted: Number(r.corrupted_count),
      safe: Number(r.safe_count), max: Number(r.max_count),
    });
  }
  return out;
}

// Creatures killed in a battle leave the field's counts (never below zero).
export async function removeKilled(
  client: pg.Pool | pg.PoolClient, fieldRef: string, killed: { species: string; corrupted: boolean }[],
): Promise<void> {
  const count = new Map<string, { natives: number; corrupted: number }>();
  for (const k of killed) {
    const c = count.get(k.species) ?? { natives: 0, corrupted: 0 };
    if (k.corrupted) c.corrupted += 1;
    else c.natives += 1;
    count.set(k.species, c);
  }
  for (const [species, c] of count) {
    await client.query(
      `UPDATE world.field_population p
       SET natural_count = GREATEST(0, p.natural_count - $3), corrupted_count = GREATEST(0, p.corrupted_count - $4)
       FROM entity.species s WHERE s.id = p.species_id AND p.field_ref = $1 AND s.species_name = $2`,
      [fieldRef, species, c.natives, c.corrupted],
    );
  }
}
