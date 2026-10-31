// Typed view of the growth keys of balance_config (hidden: server only).
// growth.tiers: stat exp points a move pays per level-up, by its tier (tag `tier:N`, default 1): `points` while the new
// level is in the first band, plus `step` for each further band of `band_levels` levels (with 6: levels 2-6, 7-12, 13-18, 19-24, 25).
// growth.race_exp: hidden move exp multipliers by race; a rule matches by move tag (any of `tags`, or every move when
// left out) and by the level the move is at (up to `max_level`, or every level); matching rules multiply.

export type RaceExpRule = { tags: string[] | null; maxLevel: number | null; mult: number };
export type GrowthConfig = {
  bandLevels: number;
  tiers: Map<number, { points: number; step: number }>;
  raceExp: Map<string, RaceExpRule[]>;
};

type RawTiers = { band_levels: number; tiers: Record<string, [number, number]> };
type RawRace = Record<string, { tags?: string[]; max_level?: number; mult: number }[]>;

export function growthConfig(tiers: RawTiers, race: RawRace): GrowthConfig {
  return {
    bandLevels: tiers.band_levels,
    tiers: new Map(Object.entries(tiers.tiers).map(([t, [points, step]]) => [Number(t), { points, step }])),
    raceExp: new Map(Object.entries(race).map(([r, rules]) => [r, rules.map((x) => ({ tags: x.tags ?? null, maxLevel: x.max_level ?? null, mult: x.mult }))])),
  };
}

// Stat exp points for reaching `newLevel` with a move of this tier (unknown tiers pay as tier 1).
export function tierPoints(g: GrowthConfig, tier: number, newLevel: number): number {
  const t = g.tiers.get(tier) ?? g.tiers.get(1)!;
  return t.points + t.step * Math.floor(Math.max(0, newLevel - 1) / g.bandLevels);
}

// Move exp multiplier for a race using a move (tags) at its current level.
export function raceExpMult(g: GrowthConfig, race: string | undefined, tags: string[], level: number): number {
  let mult = 1;
  for (const rule of (race && g.raceExp.get(race)) || []) {
    if (rule.maxLevel !== null && level > rule.maxLevel) continue;
    if (rule.tags && !rule.tags.some((t) => tags.includes(t))) continue;
    mult *= rule.mult;
  }
  return mult;
}
