import type pg from 'pg';
import type { NamePools } from './name_gen.ts';

// The name pools from entity.name_parts (seeds/34_names). Small: loaded when a name is needed.
export async function loadNamePools(db: pg.Pool | pg.PoolClient): Promise<NamePools> {
  const res = await db.query<{ race_name: string; kind: string; name: string }>('SELECT race_name, kind, name FROM entity.name_parts ORDER BY name');
  const pools: NamePools = new Map();
  for (const r of res.rows) {
    const p = pools.get(r.race_name) ?? { male: [], female: [], last: [] };
    (r.kind === 'first_m' ? p.male : r.kind === 'first_f' ? p.female : p.last).push(r.name);
    pools.set(r.race_name, p);
  }
  return pools;
}
