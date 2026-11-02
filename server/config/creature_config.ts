// Typed view of the creature.gen key of balance_config: how a regular creature is rolled at each encounter.
// Hidden: server only. Per ring (by ring number): a range for every core stat, a total move level budget and the
// die that hands it out. Corrupted creatures get stat_mult on every stat and corrupted_budget_per_step more budget
// for each ring counted from the outer one (outer ring: 1 step).

export type CreatureGenConfig = {
  statRange: Map<number, [number, number]>;
  moveBudget: Map<number, number>;
  die: Map<number, number>;
  maxMoveLevel: number;
  corruptedStatMult: number;
  corruptedBudgetPerStep: number;
};

type Raw = {
  stat_range: Record<string, [number, number]>; move_budget: Record<string, number>; die: Record<string, number>;
  max_move_level: number; corrupted_stat_mult: number; corrupted_budget_per_step: number;
};

const byRing = <T>(o: Record<string, T>) => new Map(Object.entries(o).map(([ring, v]) => [Number(ring), v]));

export function creatureGenConfig(r: Raw): CreatureGenConfig {
  return {
    statRange: byRing(r.stat_range), moveBudget: byRing(r.move_budget), die: byRing(r.die), maxMoveLevel: r.max_move_level,
    corruptedStatMult: r.corrupted_stat_mult, corruptedBudgetPerStep: r.corrupted_budget_per_step,
  };
}

const CORE = ['str', 'dex', 'int', 'end', 'luck', 'charm'];

// Every ring has a stat range, a budget and a die; every species names exactly 2 different main stats.
export function findCreatureGenProblems(gen: CreatureGenConfig, ringCount: number, species: { name: string; mainStats: string[] }[]): string[] {
  const out: string[] = [];
  for (let ring = 1; ring <= ringCount; ring++) {
    const range = gen.statRange.get(ring);
    if (!range || !(range[0] >= 1 && range[1] >= range[0])) out.push(`creature.gen ring ${ring}: stat_range missing or bad`);
    if (!(Number(gen.moveBudget.get(ring)) >= 1)) out.push(`creature.gen ring ${ring}: move_budget missing`);
    if (!(Number(gen.die.get(ring)) >= 1)) out.push(`creature.gen ring ${ring}: die missing`);
  }
  if (!(gen.maxMoveLevel >= 1)) out.push('creature.gen max_move_level must be 1 or more');
  for (const s of species) {
    if (s.mainStats.length !== 2 || new Set(s.mainStats).size !== 2 || !s.mainStats.every((m) => CORE.includes(m))) {
      out.push(`species ${s.name}: main_stats must be 2 different core stats`);
    }
  }
  return out;
}
