import type { RingConfig, ViceConfig } from '../config/world_config.ts';
import type { CoreStats } from '../stats/derived.ts';
import type { Rng } from '../util/rng.ts';
import type { PopRow } from '../world/population.ts';

// Vices (hidden). Six types, one per core stat. When the last living vice of a type dies, a new one of that type is
// born at once in the most corrupted vice-free wild hex (corruption ratio X / (N + X)); ties go to the inner ring,
// then by chance. Towns and the boss hex never get one. Its stats: its ring's creature total + vice_bonus, its type's
// stat weighted main_weight against 1 for the others.

export type BirthHex = { id: string; q: number; r: number; ring: number; town: boolean; hasVice: boolean };

export function corruptionRatio(rows: PopRow[]): number {
  const all = rows.reduce((n, r) => n + r.natives + r.corrupted, 0);
  return all > 0 ? rows.reduce((n, r) => n + r.corrupted, 0) / all : 0;
}

// The hex a new vice is born in, or null when every wild hex already has one (it waits until one dies).
export function birthHex(hexes: BirthHex[], pop: Map<string, PopRow[]>, rng: Rng): BirthHex | null {
  const open = hexes.filter((h) => !h.town && !h.hasVice && h.ring >= 1);
  if (open.length === 0) return null;
  const score = (h: BirthHex) => corruptionRatio(pop.get(h.id) ?? []);
  const best = Math.max(...open.map(score));
  const top = open.filter((h) => score(h) === best);
  const inner = Math.min(...top.map((h) => h.ring));
  const ties = top.filter((h) => h.ring === inner);
  return ties[Math.floor(rng() * ties.length)];
}

// A vice's core stats in a hex of this ring. Rounding leftovers go to the main stat so the total is exact.
export function viceStats(vice: ViceConfig, rings: RingConfig, type: keyof CoreStats, ring: number): CoreStats {
  const band = rings.creatureTotal.get(Math.max(1, Math.min(rings.count, ring)))!;
  const total = band.mean + rings.viceBonus;
  const stats = ['str', 'dex', 'int', 'end', 'luck', 'charm'] as const;
  const weight = stats.length - 1 + vice.mainWeight;
  const out = Object.fromEntries(stats.map((s) => [s, s === type ? 0 : Math.floor(total / weight)])) as CoreStats;
  out[type] = total - stats.filter((s) => s !== type).reduce((n, s) => n + out[s], 0);
  return out;
}
