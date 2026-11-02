import type { CoreStats, Stat } from '../stats/derived.ts';

// Recruit templates and the hidden recruit rules (config `recruit`, docs/WORLD.md Recruit pool). Server only.

export type RecruitSource = 'pool' | 'lineage' | 'summoner' | 'campfire';
export type RecruitTemplate = {
  name: string;
  source: RecruitSource;
  spot: string | null; // pool: where it waits (inn, training_ground, street, node)
  weight: number; // pool: how often it fills a pool place
  parents: string[]; // lineage / summoner: keeper services or notable roles that can offer it
  races: string[]; // races it can be (empty = any); the race's stat_mods add to the stats
  stats: CoreStats; // fixed whatever the ring
  open: string[]; // known from the start (taught by someone long ago), always open to the roll
  moves: string[]; // the rest of the pool: opens through unlock rules like a creature's
  flagMoves: Record<string, string[]>; // more pool moves for an entity with that trait flag (dual_wield: dual knife moves);
  // 'element' = has an element affinity, a leading '!' = has not (an elf without an element: the bow)
  life: Record<string, [number, number]>; // life skill -> level range, rolled apart from the move budget
  gear: { item: string; slot: string }[]; // slot 'bag': carried, not held (arrows)
  flagGear: Record<string, { item: string; slot: string }[]>; // gear an entity with that trait flag also carries
  elements: string[]; // forced affinity (the apprentice healer is always holy)
  mercenary: boolean; // hired for a daily wage, money only
};

export type Notable = { role: string; minPopulation: number };
export type RecruitConfig = {
  poolShare: { outer: number; step: number; min: number }; // share of the town's people, outer ring first
  budgetSpread: number; // the move budget is the ring's creature budget +- this
  notables: Notable[];
  threshold: { base: number; perLevel: number; lineageMult: number }; // favor + charm + fame needed
  wage: { base: number; perLevel: number }; // mercenary copper per world day
  inheritShare: number; // a lineage recruit starts with up to this share of the player's favor with the parent
  summonerFrom: string[]; // notable roles a summoner can descend from
  ammoCarried: number; // arrows (any ammo) a recruit carries per ammo item in its gear
};

type Raw = Record<string, unknown>;
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const gearList = (v: unknown) => (Array.isArray(v) ? v.map((g) => ({ item: String(g.item), slot: String(g.slot) })) : []);
const STAT_KEYS: Stat[] = ['str', 'dex', 'int', 'end', 'luck', 'charm'];

export function parseTemplate(name: string, d: Raw): RecruitTemplate {
  const stats = (d.stats ?? {}) as Record<string, number>;
  return {
    name,
    source: String(d.source ?? 'pool') as RecruitSource,
    spot: typeof d.spot === 'string' ? d.spot : null,
    weight: Number(d.weight ?? 0),
    parents: strs(d.parents),
    races: strs(d.races),
    stats: Object.fromEntries(STAT_KEYS.map((s) => [s, Number(stats[s] ?? 0)])) as CoreStats,
    open: strs(d.open),
    moves: strs(d.moves),
    flagMoves: Object.fromEntries(Object.entries((d.flag_moves as Raw) ?? {}).map(([k, v]) => [k, strs(v)])),
    life: (d.life as Record<string, [number, number]>) ?? {},
    gear: gearList(d.gear),
    flagGear: Object.fromEntries(Object.entries((d.flag_gear as Raw) ?? {}).map(([k, v]) => [k, gearList(v)])),
    elements: strs(d.elements),
    mercenary: d.mercenary === true,
  };
}

export function recruitConfig(r: Raw): RecruitConfig {
  const p = r.pool_share as Raw;
  const t = r.threshold as Raw;
  const w = r.wage as Raw;
  return {
    poolShare: { outer: Number(p.outer), step: Number(p.step), min: Number(p.min) },
    budgetSpread: Number(r.budget_spread),
    notables: (r.notables as Raw[]).map((n) => ({ role: String(n.role), minPopulation: Number(n.min_population ?? 0) })),
    threshold: { base: Number(t.base), perLevel: Number(t.per_level), lineageMult: Number(t.lineage_mult) },
    wage: { base: Number(w.base), perLevel: Number(w.per_level) },
    inheritShare: Number(r.inherit_share),
    summonerFrom: strs(r.summoner_from),
    ammoCarried: Number(r.ammo_carried ?? 0),
  };
}

// Pool share by ring: the outer ring's share, one step less per ring inward, never below the minimum.
export function poolShare(c: RecruitConfig, ring: number, rings: number): number {
  return Math.max(c.poolShare.min, c.poolShare.outer - c.poolShare.step * (rings - ring));
}

// How many wait in a town's pool: its share of the people living there now.
export const poolSize = (c: RecruitConfig, ring: number, rings: number, population: number) =>
  Math.round(poolShare(c, ring, rings) * Math.max(0, population));

// Notables a town of this size has (village elder and chief guard everywhere; bigger towns have more).
export const notablesFor = (c: RecruitConfig, population: number) =>
  c.notables.filter((n) => population >= n.minPopulation).map((n) => n.role);

// Favor + charm + fame a recruit needs, from its total move levels. A lineage offer needs lineage_mult as much.
export function recruitThreshold(c: RecruitConfig, totalLevels: number, lineage: boolean): number {
  return (c.threshold.base + c.threshold.perLevel * totalLevels) * (lineage ? c.threshold.lineageMult : 1);
}

export const mercenaryWage = (c: RecruitConfig, totalLevels: number) => Math.round(c.wage.base + c.wage.perLevel * totalLevels);

const SOURCES: RecruitSource[] = ['pool', 'lineage', 'summoner', 'campfire'];

// Startup check: known moves (life skills under life), items and hand slots, a spot for pool templates, parents for
// lineage ones, elements from the element list, and known races.
export function findTemplateProblems(
  templates: readonly RecruitTemplate[], moveCategory: ReadonlyMap<string, string>, items: ReadonlySet<string>,
  slots: readonly string[], elements: readonly string[], races: ReadonlySet<string> = new Set(),
): string[] {
  const out: string[] = [];
  for (const t of templates) {
    const at = `recruit template ${t.name}`;
    if (!SOURCES.includes(t.source)) out.push(`${at}: unknown source ${t.source}`);
    if (t.source === 'pool' && (!t.spot || t.weight <= 0)) out.push(`${at}: a pool template needs a spot and a weight`);
    if (t.source === 'lineage' && t.parents.length === 0) out.push(`${at}: a lineage template needs parents`);
    if (STAT_KEYS.some((s) => !(t.stats[s] > 0))) out.push(`${at}: every core stat must be above 0`);
    for (const m of [...t.open, ...t.moves, ...Object.values(t.flagMoves).flat()]) {
      if (!moveCategory.has(m)) out.push(`${at}: unknown move ${m}`);
      else if (moveCategory.get(m) === 'life') out.push(`${at}: ${m} is a life skill, list it under life`);
    }
    for (const skill of Object.keys(t.life)) if (moveCategory.get(skill) !== 'life') out.push(`${at}: ${skill} is not a life skill`);
    for (const g of [...t.gear, ...Object.values(t.flagGear).flat()]) {
      if (!items.has(g.item)) out.push(`${at}: unknown item ${g.item}`);
      if (!slots.includes(g.slot) && g.slot !== 'bag') out.push(`${at}: unknown slot ${g.slot}`);
    }
    for (const e of t.elements) if (!elements.includes(e)) out.push(`${at}: unknown element ${e}`);
    for (const r of t.races) if (races.size > 0 && !races.has(r)) out.push(`${at}: unknown race ${r}`);
  }
  return out;
}
