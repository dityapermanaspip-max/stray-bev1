import type { BalanceConfig } from '../config/balance.ts';
import type { CoreStats } from '../stats/derived.ts';
import type { Rng } from '../util/rng.ts';
import { rollMoves, type RolledCreature } from '../world/creature_roll.ts';

// A vice's moves at birth (hidden): its type's list from config `vice.moves`, all open (it learned them long ago),
// levels handed out like a creature's from its ring's move budget + budget_bonus. No stat exp: stat exp only comes
// from the move level-up function, after it is born (a vice that wins or is fled from keeps growing).

export function rollViceMoves(cfg: BalanceConfig, type: keyof CoreStats, ring: number, rng: Rng): RolledCreature['moves'] {
  const r = Math.max(1, Math.min(cfg.rings.count, Math.round(ring)));
  const list = cfg.vice.moves[type] ?? [];
  const budget = cfg.creatureGen.moveBudget.get(r)! + cfg.vice.budgetBonus;
  return rollMoves(cfg, { pool: list, open: list, rules: [], budget, die: cfg.creatureGen.die.get(r)!, rng });
}
