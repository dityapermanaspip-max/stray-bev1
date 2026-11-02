import type pg from 'pg';

// Town cultures (world.cultures, docs/WORLD.md Cultures): which folk live in a town, its field template (its doors),
// goods it is known for, what it refuses to trade, its job shares and who waits in its recruit pool.

export type Culture = {
  name: string;
  race: string;
  townTemplate: string;
  biomes: string[]; // where it settles, best first
  specialties: string[]; // goods families on top of the biome's
  taboo: string[]; // item types, shapes or goods families its shops never take or stock
  jobs: Record<string, number> | null; // null = the world.gen town jobs
  poolWeights: Record<string, number>; // recruit template -> weight multiplier (0 = never here)
  visitorShare: number; // share of its recruits who are of another race
};

type Row = { culture_name: string; race_name: string; town_template: string; biomes: string[]; data: Record<string, unknown> };

export function parseCulture(r: Row): Culture {
  const d = r.data ?? {};
  const strs = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  return {
    name: r.culture_name,
    race: r.race_name,
    townTemplate: r.town_template,
    biomes: r.biomes ?? [],
    specialties: strs(d.specialties),
    taboo: strs(d.taboo),
    jobs: d.jobs && typeof d.jobs === 'object' ? (d.jobs as Record<string, number>) : null,
    poolWeights: (d.pool_weights as Record<string, number>) ?? {},
    visitorShare: Number(d.visitor_share ?? 0),
  };
}

// In position order: the first is the fallback culture.
export async function loadCultures(db: pg.Pool | pg.PoolClient): Promise<Culture[]> {
  const res = await db.query<Row>(
    `SELECT c.culture_name, r.race_name, c.town_template, c.biomes, c.data
     FROM world.cultures c JOIN entity.races r ON r.id = c.race_id ORDER BY c.position`,
  );
  return res.rows.map(parseCulture);
}

// The culture that settles in a biome (best match first), else the fallback.
export function cultureFor(cultures: readonly Culture[], biome: string): Culture | null {
  let best: Culture | null = null;
  let rank = Infinity;
  for (const c of cultures) {
    const i = c.biomes.indexOf(biome);
    if (i >= 0 && i < rank) { best = c; rank = i; }
  }
  return best ?? cultures[0] ?? null;
}
