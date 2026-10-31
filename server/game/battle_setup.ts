import { growerEntity } from '../battle/from_state.ts';
import { BattleInstance } from '../battle/instance.ts';
import type { BattleEntity } from '../battle/types.ts';
import { loadEntityState, type EntityState } from '../data/entity_load.ts';
import { loadInventory } from '../data/item_repo.ts';
import type { Inventory } from '../inventory/bag.ts';
import { buildCombatGear } from '../inventory/combat_gear.ts';
import { buildCreature } from '../sim/combatants.ts';
import type { Foe } from '../world/encounter.ts';
import type { GameWorld } from './world.ts';

// Builds one field battle from the database: the player as saved (body, gear, loadout) against the creatures met.

// What the field room hands the battle room. The spot is where the player stands (already saved).
export type BattleOrder = { entityId: string; name: string; fieldRef: string; x: number; y: number; foes: Foe[]; seed: number };

export type Fight = {
  order: BattleOrder;
  instance: BattleInstance;
  player: BattleEntity;
  foes: BattleEntity[];
  state: EntityState;
  inventory: Inventory;
};

export async function setUpFight(world: GameWorld, order: BattleOrder): Promise<Fight> {
  const { cfg } = world.data;
  const [state, inventory] = await Promise.all([loadEntityState(world.pool, order.entityId), loadInventory(world.pool, order.entityId)]);
  const player = growerEntity(cfg, {
    id: order.entityId, kind: 'player', side: 'party', row: 'front', speaker: 'self', controller: 'player',
    progress: state.progress, loadout: state.loadout, bodyParts: state.bodyParts, body: state.body,
    gear: buildCombatGear(cfg, world.catalog, inventory),
  });
  const foes = order.foes.map((f, i) => {
    const def = world.species.get(f.species);
    if (!def) throw new Error(`unknown species ${f.species}`);
    return buildCreature(cfg, def, i + 1, f.corrupted);
  });
  const instance = new BattleInstance(world.data, {
    entities: [player, ...foes],
    progress: new Map([[order.entityId, state.progress]]),
    summonerSides: new Set(),
    seed: order.seed,
  });
  return { order, instance, player, foes, state, inventory };
}

// Snapshot shape for battle.battles.state (server only).
export function fightState(f: Fight): object {
  const { fieldRef, x, y } = f.order;
  return {
    fieldRef, x, y, winner: f.instance.winner,
    foes: f.foes.map((e) => ({ id: e.id, corrupted: e.corrupted, hp: e.hp, stamina: e.stamina, mana: e.mana })),
  };
}
