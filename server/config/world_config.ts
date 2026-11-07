// Typed view of the world.rings key of balance_config: the ring ladder of a round. Hidden: server only.
// Ring `count` is the outer ring (where players arrive), ring 1 the vices' ring, ring 0 the boss hex.
// Per ring: regular creatures' total core stats (mean +- spread), vices one step (vice_bonus) above their ring,
// conversion (tick.conversion.rate at the outer ring, plus per_ring for each ring closer to the centre), and a wild
// hex's starting counts: natives and corrupted each a random share of max, the same on every ring.

export type RingConfig = {
  count: number;
  creatureTotal: Map<number, { mean: number; spread: number }>; // ring -> regular creatures' total core stats
  viceBonus: number;
  bossTotal: number;
  conversionPerRing: number;
  start: { natives: [number, number]; corrupted: [number, number] }; // shares of max
};

type RawRings = {
  count: number; creature_total: Record<string, [number, number]>; vice_bonus: number; boss_total: number;
  conversion_per_ring: number; start: { natives: [number, number]; corrupted: [number, number] };
};

export function ringConfig(raw: RawRings): RingConfig {
  const creatureTotal = new Map(Object.entries(raw.creature_total).map(([ring, [mean, spread]]) => [Number(ring), { mean, spread }]));
  for (let ring = 1; ring <= raw.count; ring++) {
    if (!creatureTotal.has(ring)) throw new Error(`world.rings creature_total missing ring ${ring}`);
  }
  return {
    count: raw.count, creatureTotal, viceBonus: raw.vice_bonus, bossTotal: raw.boss_total,
    conversionPerRing: raw.conversion_per_ring,
    start: { natives: raw.start.natives, corrupted: raw.start.corrupted },
  };
}

const stepsIn = (rings: RingConfig, ring: number) => Math.max(0, rings.count - Math.max(ring, 1));

// Conversion rate per conversion tick in a hex of this ring.
export const conversionRate = (rings: RingConfig, outerRate: number, ring: number) => outerRate + rings.conversionPerRing * stepsIn(rings, ring);

// A wild hex's starting counts for one species (world generation, Step 4): natives and corrupted rolled in their ranges.
// A species born corrupted has no natives: the whole head count starts corrupted.
export function startCounts(rings: RingConfig, max: number, rng: () => number, bornCorrupted = false): { natives: number; corrupted: number } {
  const pick = ([lo, hi]: [number, number]) => Math.round(max * (lo + rng() * (hi - lo)));
  const natives = pick(rings.start.natives);
  const corrupted = pick(rings.start.corrupted);
  return bornCorrupted ? { natives: 0, corrupted: natives + corrupted } : { natives, corrupted };
}

// Species living outside the round's rings. (Their strength is rolled per ring: config creature.gen.)
export function findRingProblems(rings: RingConfig, species: { name: string; ringMin: number; ringMax: number }[]): string[] {
  return species.filter((s) => s.ringMin < 1 || s.ringMax > rings.count || s.ringMin > s.ringMax)
    .map((s) => `species ${s.name}: rings ${s.ringMin}-${s.ringMax} outside 1-${rings.count}`);
}

// Vices (config `vice`): one type per core stat; main_weight: the type's stat against 1 for each other stat;
// find_permille: chance an encounter in a vice's hex is the vice itself (finding one is hard: rumors, slim odds).
// race: what a vice is made of (its body parts); moves: per type, the moves it knows from birth (all open, they train
// its stat); budget_bonus: move levels on top of its ring's creature budget.
// How a vice or the boss is drawn in battle: an actor sheet (path under public/assets/actors), a colour wash, a size.
export type Figure = { sheet: string; tint: number | null; scale: number };
type RawFigure = { sheet: string; tint?: string; scale?: number };
export const figureConfig = (raw: RawFigure): Figure => ({ sheet: raw.sheet, tint: raw.tint ? parseInt(raw.tint.replace('#', ''), 16) : null, scale: raw.scale ?? 1 });

export type ViceConfig = {
  types: ('str' | 'dex' | 'int' | 'end' | 'luck' | 'charm')[]; mainWeight: number; findPermille: number;
  race: string; budgetBonus: number; moves: Record<string, string[]>; figures: Record<string, Figure>; // figures: by type
};

export function viceConfig(raw: {
  types: ViceConfig['types']; main_weight: number; find_permille: number; race?: string; budget_bonus?: number; moves?: Record<string, string[]>;
  figures?: Record<string, RawFigure>;
}): ViceConfig {
  return {
    types: raw.types, mainWeight: raw.main_weight, findPermille: raw.find_permille,
    race: raw.race ?? 'human', budgetBonus: raw.budget_bonus ?? 0, moves: raw.moves ?? {},
    figures: Object.fromEntries(Object.entries(raw.figures ?? {}).map(([t, f]) => [t, figureConfig(f)])),
  };
}

// Startup check: every type has moves, and every move exists.
export function findViceProblems(vice: ViceConfig, moves: ReadonlySet<string>): string[] {
  return vice.types.flatMap((t) => {
    const list = vice.moves[t] ?? [];
    if (list.length === 0) return [`vice ${t}: no moves`];
    return list.filter((m) => !moves.has(m)).map((m) => `vice ${t}: unknown move ${m}`);
  });
}

// The boss (config `boss`, `key_weakening`, `boss_set_weakening`; all hidden). Stats: world.rings boss_total split
// evenly. moves: its whole move list (growth is capped by it), move_budget levels rolled at its making; every vice
// born after the round start feeds it exp_per_vice move exp. Keys carried at entry weaken it at fight start
// (per_key for the first of a type, x duplicate_falloff for each more), each consumed key set adds set_weakening
// for good; the sum never passes max_weakening. Weakening lowers every core stat by that share for the fight.
export type BossConfig = {
  race: string; moves: string[]; moveBudget: number; expPerVice: number; maxWeakening: number;
  perKey: number; duplicateFalloff: number; setWeakening: number; figure: Figure | null;
};

export function bossConfig(
  raw: { race: string; moves: string[]; move_budget: number; exp_per_vice: number; max_weakening: number; figure?: RawFigure },
  keys: { per_key: number; duplicate_falloff: number }, setWeakening: number,
): BossConfig {
  return {
    race: raw.race, moves: raw.moves, moveBudget: raw.move_budget, expPerVice: raw.exp_per_vice, maxWeakening: raw.max_weakening,
    perKey: keys.per_key, duplicateFalloff: keys.duplicate_falloff, setWeakening, figure: raw.figure ? figureConfig(raw.figure) : null,
  };
}
