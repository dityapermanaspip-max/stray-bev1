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
export function startCounts(rings: RingConfig, max: number, rng: () => number): { natives: number; corrupted: number } {
  const pick = ([lo, hi]: [number, number]) => Math.round(max * (lo + rng() * (hi - lo)));
  return { natives: pick(rings.start.natives), corrupted: pick(rings.start.corrupted) };
}

// Species whose total core stats fall outside the band of a ring they live in.
export function findRingProblems(rings: RingConfig, species: { name: string; total: number; ringMin: number; ringMax: number }[]): string[] {
  const out: string[] = [];
  for (const s of species) {
    if (s.ringMin < 1 || s.ringMax > rings.count || s.ringMin > s.ringMax) out.push(`species ${s.name}: rings ${s.ringMin}-${s.ringMax} outside 1-${rings.count}`);
    for (let ring = Math.max(1, s.ringMin); ring <= Math.min(rings.count, s.ringMax); ring++) {
      const band = rings.creatureTotal.get(ring)!;
      if (Math.abs(s.total - band.mean) > band.spread) out.push(`species ${s.name}: total ${s.total} outside ring ${ring} (${band.mean} +- ${band.spread})`);
    }
  }
  return out;
}
