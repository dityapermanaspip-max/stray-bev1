// Typed view of the world.gen key of balance_config: how a new round's map is made. Hidden: server only.
// See seeds/10_worldgen/02_config.sql.

export type WorldGenConfig = {
  corridors: [number, number];
  towns: Map<number, number>; // ring -> towns
  townSpacing: number;
  centreBiome: string;
  biomes: Map<number, Record<string, number>>; // ring -> biome weights
  clump: number;
  hexMax: number;
  safeShare: number;
  town: {
    pursePerPerson: number;
    maxBuy: Map<number, number>;
    population: Map<number, number>;
    specialties: Record<string, string[]>; // biome -> goods families
    jobs: Record<string, number>;
  };
  viceRings: number[];
};

type Raw = {
  corridors: [number, number]; towns: Record<string, number>; town_spacing: number; centre_biome: string;
  biomes: Record<string, Record<string, number>>; clump: number; hex_max: number; safe_share: number;
  town: { purse_per_person: number; max_buy: Record<string, number>; population: Record<string, number>; specialties: Record<string, string[]>; jobs: Record<string, number> };
  vice_rings: number[];
};

const byRing = <T>(r: Record<string, T>) => new Map(Object.entries(r).map(([k, v]) => [Number(k), v]));

export function worldGenConfig(r: Raw): WorldGenConfig {
  return {
    corridors: r.corridors, towns: byRing(r.towns), townSpacing: r.town_spacing, centreBiome: r.centre_biome,
    biomes: byRing(r.biomes), clump: r.clump, hexMax: r.hex_max, safeShare: r.safe_share,
    town: {
      pursePerPerson: r.town.purse_per_person, maxBuy: byRing(r.town.max_buy), population: byRing(r.town.population),
      specialties: r.town.specialties, jobs: r.town.jobs,
    },
    viceRings: r.vice_rings,
  };
}

// Rules that would make a broken world: unknown biomes, rings without weights, impossible town counts.
export function findWorldGenProblems(g: WorldGenConfig, rings: number, biomes: Set<string>): string[] {
  const out: string[] = [];
  if (!biomes.has(g.centreBiome)) out.push(`world.gen centre_biome ${g.centreBiome}: no such biome`);
  for (let ring = 1; ring <= rings; ring++) {
    const w = g.biomes.get(ring);
    if (!w || !Object.values(w).some((x) => x > 0)) out.push(`world.gen biomes: ring ${ring} has no weights`);
    for (const b of Object.keys(w ?? {})) if (!biomes.has(b)) out.push(`world.gen biomes ring ${ring}: no such biome ${b}`);
    if ((g.towns.get(ring) ?? 0) > ring * 6) out.push(`world.gen towns: ring ${ring} has only ${ring * 6} hexes`);
    if ((g.towns.get(ring) ?? 0) > 0 && (!g.town.population.has(ring) || !g.town.maxBuy.has(ring))) out.push(`world.gen town: ring ${ring} needs population and max_buy`);
  }
  if (!(g.corridors[0] >= 3 && g.corridors[1] <= 7 && g.corridors[0] <= g.corridors[1])) out.push('world.gen corridors: must be within 3-7');
  return out;
}
