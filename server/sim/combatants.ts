import type { BalanceConfig } from '../config/balance.ts';
import { createEntity } from '../battle/factory.ts';
import { growerEntity } from '../battle/from_state.ts';
import type { BattleEntity } from '../battle/types.ts';
import type { SpeciesDef } from '../data/species_repo.ts';
import type { Progress } from '../growth/level_up.ts';
import type { Loadout } from '../loadout/loadout.ts';

// Builds the sim's player and creatures. Server-side developer tooling.

export function buildPlayer(cfg: BalanceConfig, progress: Progress, loadout: Loadout, bodyParts: string[]): BattleEntity {
  return growerEntity(cfg, {
    id: 'player',
    kind: 'player',
    side: 'party',
    row: 'front',
    speaker: 'self',
    controller: 'ai',
    progress,
    loadout,
    bodyParts,
    body: null,
  });
}

export function buildCreature(cfg: BalanceConfig, def: SpeciesDef, index: number, corrupted: boolean): BattleEntity {
  return createEntity(cfg, {
    id: `${def.name}_${index}`,
    kind: 'native',
    side: 'enemy',
    row: 'front',
    speaker: null,
    grows: false,
    corrupted,
    controller: 'ai',
    stats: def.baseStats,
    bodyParts: def.bodyParts,
    moves: def.moves.map((m) => ({ name: m, level: 1 })),
    resist: def.resist,
  });
}
