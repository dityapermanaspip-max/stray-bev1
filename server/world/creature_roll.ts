import type { BalanceConfig } from '../config/balance.ts';
import type { SpeciesDef } from '../data/species_repo.ts';
import type { CoreStats } from '../stats/derived.ts';
import type { Rng } from '../util/rng.ts';
import { findUnlocks, type UnlockRule } from '../growth/unlocks.ts';

// A regular creature rolled at encounter time from its species and the ring it is met in (creatures are counts,
// never stored one by one, so two bears of a hex differ). Hidden: server only, numbers from config creature.gen.
//   Stats: every core stat in the ring's range; the species' 2 main stats roll in the upper half of it.
//   Moves: the ring's budget is handed out by die rolls: roll the ring's die (never more than what is left), give
//   that many levels to a random move of the species' pool (a move picked again adds up, capped at max_move_level;
//   what does not fit is rolled again). Moves never picked are not known.
//   Unlocks: only open moves are picked: a pool move with no unlock rule is open from the start; one with rules
//   opens once a rule group passes on the levels rolled so far (Triple Peck opens when Peck reaches its level).
//   Loadout: like a player it fights with loadout_slots moves: its best ones (highest level; on a tie, the deeper
//   move that needed an unlock).
//   Corrupted: the species' corrupted-only moves join the pool; every stat x corrupted_stat_mult, and corrupted_budget_per_step more budget per ring from the outside.

// moves: best first; equipped: the best loadout_slots of them (like a player's loadout), the only ones it fights with.
export type RolledCreature = { stats: CoreStats; moves: { name: string; level: number; equipped: boolean }[] };

const CORE = ['str', 'dex', 'int', 'end', 'luck', 'charm'] as const;

export function rollCreature(cfg: BalanceConfig, def: SpeciesDef, ring: number, corrupted: boolean, rng: Rng): RolledCreature {
  const gen = cfg.creatureGen;
  const r = Math.max(1, Math.min(cfg.rings.count, Math.round(ring)));
  const [lo, hi] = gen.statRange.get(r)!;
  const between = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
  const stats = Object.fromEntries(CORE.map((s) => {
    const base = def.mainStats.includes(s) ? between(Math.ceil((lo + hi) / 2), hi) : between(lo, hi);
    return [s, corrupted ? Math.round(base * gen.corruptedStatMult) : base];
  })) as CoreStats;

  const steps = cfg.rings.count - r + 1; // outer ring = 1
  const budget = gen.moveBudget.get(r)! + (corrupted ? gen.corruptedBudgetPerStep * steps : 0);
  const pool = corrupted ? [...def.moves, ...(def.corruptedMoves ?? [])] : def.moves; // corrupted-only moves join a corrupted pool
  return { stats, moves: rollMoves(cfg, { pool, rules: def.unlocks ?? [], budget, die: gen.die.get(r)!, rng }) };
}

export type MoveRoll = { pool: string[]; rules: UnlockRule[]; budget: number; die: number; rng: Rng; open?: string[] };

// Hands out a move budget by die rolls over the open moves of a pool (see above); best first, best loadout_slots
// equipped. `open` moves are open from the start whatever their rules say (a recruit was taught them long ago).
export function rollMoves(cfg: BalanceConfig, m: MoveRoll): RolledCreature['moves'] {
  const gen = cfg.creatureGen;
  const between = (a: number, b: number) => a + Math.floor(m.rng() * (b - a + 1));
  let left = m.budget;
  const levels = new Map<string, number>();
  const always = new Set(m.open ?? []);
  const pool = [...new Set([...(m.open ?? []), ...m.pool])];
  const locked = new Set(pool.filter((name) => !always.has(name) && m.rules.some((r) => r.move === name)));
  const full = new Set<string>();
  const open = () => pool.filter((name) => !locked.has(name) && !full.has(name));
  for (let pick = open(); left > 0 && pick.length > 0; pick = open()) {
    const amount = Math.min(left, between(1, m.die));
    const move = pick[Math.floor(m.rng() * pick.length)];
    const now = levels.get(move) ?? 0;
    const given = Math.min(amount, gen.maxMoveLevel - now);
    levels.set(move, now + given);
    left -= given;
    if (now + given >= gen.maxMoveLevel) full.add(move); // full: never picked again
    if (locked.size > 0) unlock(m.rules, levels, locked);
  }
  const deeper = new Set(m.rules.map((r) => r.move));
  const best = [...levels].sort((a, b) => b[1] - a[1] || Number(deeper.has(b[0])) - Number(deeper.has(a[0])));
  return best.map(([name, level], i) => ({ name, level, equipped: i < cfg.loadoutSlots }));
}

// Opens the locked moves whose rules now pass on the rolled levels (mastery and combo; trainers and scrolls never do).
function unlock(rules: UnlockRule[], levels: Map<string, number>, locked: Set<string>): void {
  const moves = new Map([...levels].map(([name, level]) => [name, { level, exp: 0 }]));
  for (const l of findUnlocks(rules.filter((r) => locked.has(r.move)), { moves, recipes: new Set() })) locked.delete(l.move);
}
