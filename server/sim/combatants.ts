import type { BalanceConfig } from '../config/balance.ts';
import { createEntity } from '../battle/factory.ts';
import { growerEntity } from '../battle/from_state.ts';
import type { BattleEntity } from '../battle/types.ts';
import type { SpeciesDef } from '../data/species_repo.ts';
import type { Progress } from '../growth/level_up.ts';
import type { Loadout } from '../loadout/loadout.ts';
import type { Rng } from '../util/rng.ts';
import { rollCreature } from '../world/creature_roll.ts';

// Builds the sim's player and creatures. Server-side developer tooling.

export function buildPlayer(cfg: BalanceConfig, progress: Progress, loadout: Loadout, bodyParts: string[]): BattleEntity {
  return growerEntity(cfg, {
    id: 'player',
    kind: 'player',
    side: 'party',
    slot: 1,
    speaker: 'self',
    controller: 'ai',
    progress,
    loadout,
    bodyParts,
    body: null,
  });
}

// A regular creature rolled for the ring it is met in (stats and learned move levels differ every time).
export function buildCreature(cfg: BalanceConfig, def: SpeciesDef, index: number, corrupted: boolean, ring: number, rng: Rng, slot = index): BattleEntity {
  const rolled = rollCreature(cfg, def, ring, corrupted, rng);
  return createEntity(cfg, {
    id: `${def.name}_${index}`,
    kind: 'native',
    side: 'enemy',
    slot,
    speaker: null,
    grows: false,
    corrupted,
    controller: 'ai',
    stats: rolled.stats,
    bodyParts: def.bodyParts,
    moves: rolled.moves.filter((m) => m.equipped).map(({ name, level }) => ({ name, level })),
    resist: def.resist,
  });
}
