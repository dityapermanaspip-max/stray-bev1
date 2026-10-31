// Typed views of the `gather` and `food` keys of balance_config (hidden: server only).
// See seeds/11_gather/01_config_moves.sql and seeds/12_food/01_food.sql.

export type NodeKind = {
  move: string; // the life skill this node uses and grows
  tools: string[]; // weapon or tool types that work here
  bonusTools: string[]; // work better: finds x bonusMult
  bonusMult: number;
  uses: number; // finds before the node is spent
  refillPerHour: number; // uses given back per world hour
  exp: number; // move exp per use
  near: string[]; // only next to one of these terrains (empty: anywhere)
};
export type GatherConfig = { chanceBase: number; chancePerLevel: number; guardPermille: number; kinds: Record<string, NodeKind> };
export type FoodConfig = { durationMinutes: number };

type RawKind = {
  move: string; tools: string[]; bonus_tools: string[]; bonus_mult: number; uses: number; refill_per_hour: number; exp: number; near: string[];
};
type Raw = { chance_base: number; chance_per_level: number; guard_permille: number; kinds: Record<string, RawKind> };

export function gatherConfig(r: Raw): GatherConfig {
  const kinds = Object.fromEntries(Object.entries(r.kinds).map(([name, k]) => [name, {
    move: k.move, tools: k.tools, bonusTools: k.bonus_tools ?? [], bonusMult: k.bonus_mult ?? 1, uses: k.uses,
    refillPerHour: k.refill_per_hour, exp: k.exp, near: k.near ?? [],
  }]));
  return { chanceBase: r.chance_base, chancePerLevel: r.chance_per_level, guardPermille: r.guard_permille, kinds };
}

export const foodConfig = (r: { duration_minutes: number }): FoodConfig => ({ durationMinutes: r.duration_minutes });

// Problems for the startup check: every kind needs a known move, tools, and sane numbers.
export function findGatherProblems(cfg: GatherConfig, moves: Set<string>, lootTables: Set<string>): string[] {
  const problems: string[] = [];
  for (const [name, k] of Object.entries(cfg.kinds)) {
    if (!moves.has(k.move)) problems.push(`gather ${name}: unknown move ${k.move}`);
    if (k.tools.length === 0) problems.push(`gather ${name}: needs at least one tool type`);
    if (!(k.uses >= 1) || !(k.refillPerHour >= 0) || !(k.exp >= 0) || !(k.bonusMult >= 1)) problems.push(`gather ${name}: bad numbers`);
    for (const side of ['native', 'corrupted']) {
      if (!lootTables.has(`node_${name}_${side}`)) problems.push(`gather ${name}: no loot table node_${name}_${side}`);
    }
  }
  return problems;
}
