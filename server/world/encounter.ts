import type { EncounterConfig } from '../config/balance.ts';
import { badChance, PERMILLE, rollPermille, type LuckConfig } from '../util/luck.ts';
import type { Rng } from '../util/rng.ts';
import type { PopRow } from './population.ts';

// Encounters, rolled per tile stepped. Chance = per_step_permille x density (total pop / max pop, capped at 1),
// lowered by the party leader's luck. Busier fields also send bigger groups. Nothing here reaches the client
// except the creatures met.

// slot: set by authored encounters, else front first. vice: a named vice (an entity, not a count; species is 'vice').
// boss: the round's boss (species 'boss'), with this fight's weakening share and the keys spent to reach it.
export type Foe = {
  species: string; corrupted: boolean; slot?: number; vice?: { id: string; type: string }; boss?: { id: string; weaken: number; keys: string[] };
};

export function density(rows: PopRow[]): number {
  const max = rows.reduce((s, r) => s + r.max, 0);
  if (max <= 0) return 0;
  return Math.min(1, rows.reduce((s, r) => s + r.natives + r.corrupted, 0) / max);
}

export function encounterPermille(cfg: EncounterConfig, luck: LuckConfig, rows: PopRow[], leaderLuck: number): number {
  const base = Math.round(cfg.perStepPermille * density(rows));
  return base > 0 ? badChance(luck, base, leaderLuck) : 0;
}

// Largest group at this density: 1 when quiet, up to group_max when full, never above cap (the corridor next to a town).
export function groupLimit(cfg: EncounterConfig, rows: PopRow[], cap = cfg.groupMax): number {
  return Math.min(cap, 1 + Math.floor(density(rows) * (cfg.groupMax - 1)));
}

// Species by head count; each creature is corrupted by its species' share.
function pickFoe(rows: PopRow[], rng: Rng): Foe {
  const weights = rows.map((r) => r.natives + r.corrupted);
  let roll = rng() * weights.reduce((s, w) => s + w, 0);
  const r = rows.find((_, i) => (roll -= weights[i]) < 0) ?? rows[rows.length - 1];
  const share = Math.round((PERMILLE * r.corrupted) / Math.max(1, r.natives + r.corrupted));
  return { species: r.species, corrupted: rollPermille(rng, share) };
}

// One step: null, or the group that jumps out.
export function rollEncounter(cfg: EncounterConfig, luck: LuckConfig, rows: PopRow[], leaderLuck: number, rng: Rng, cap = cfg.groupMax): Foe[] | null {
  if (!rollPermille(rng, encounterPermille(cfg, luck, rows, leaderLuck))) return null;
  const size = 1 + Math.floor(rng() * groupLimit(cfg, rows, cap));
  return Array.from({ length: size }, () => pickFoe(rows, rng));
}

// A corridor's creatures: the two hexes' rows mixed by how far along the chain it lies (share of hex B).
export function blendRows(a: PopRow[], b: PopRow[], shareB: number): PopRow[] {
  const mix = new Map<string, PopRow>();
  const add = (rows: PopRow[], w: number) => {
    for (const r of rows) {
      const m = mix.get(r.species) ?? { species: r.species, natives: 0, corrupted: 0, safe: 0, max: 0 };
      m.natives += r.natives * w;
      m.corrupted += r.corrupted * w;
      m.safe += r.safe * w;
      m.max += r.max * w;
      mix.set(r.species, m);
    }
  };
  add(a, 1 - shareB);
  add(b, shareB);
  return [...mix.values()].map((m) => ({
    species: m.species, natives: Math.round(m.natives), corrupted: Math.round(m.corrupted), safe: Math.round(m.safe), max: Math.round(m.max),
  }));
}
