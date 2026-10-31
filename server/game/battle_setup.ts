import { matchMaker } from '@colyseus/core';
import { growerEntity } from '../battle/from_state.ts';
import { BattleInstance } from '../battle/instance.ts';
import type { BattleEntity } from '../battle/types.ts';
import { loadEntityState, type EntityState } from '../data/entity_load.ts';
import { loadInventory } from '../data/item_repo.ts';
import { mealActive, mealCosts } from '../food/food.ts';
import { loadMeal } from '../food/food_service.ts';
import type { Inventory } from '../inventory/bag.ts';
import { buildCombatGear } from '../inventory/combat_gear.ts';
import { buildCreature } from '../sim/combatants.ts';
import type { Foe } from '../world/encounter.ts';
import { BATTLE_ROOM } from '../../shared/battle.ts';
import { startFighting, stopFighting } from '../util/entity_lock.ts';
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
  const [state, inventory, meal] = await Promise.all([
    loadEntityState(world.pool, order.entityId), loadInventory(world.pool, order.entityId), loadMeal(world.pool, order.entityId),
  ]);
  const player = growerEntity(cfg, {
    id: order.entityId, kind: 'player', side: 'party', row: 'front', speaker: 'self', controller: 'player',
    progress: state.progress, loadout: state.loadout, bodyParts: state.bodyParts, body: state.body,
    gear: buildCombatGear(cfg, world.catalog, inventory),
  });
  if (mealActive(cfg, meal, Date.now())) player.costMult = mealCosts(world.catalog.get(meal.item)); // hidden food effect
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

// The field room's handoff: marks the player fighting, creates the private battle room and reserves their seat
// there. Null when it could not be set up (the player is free again).
export async function openBattle(order: BattleOrder): Promise<unknown | null> {
  startFighting(order.entityId); // the battle room clears it once its result is saved
  try {
    const room = await matchMaker.createRoom(BATTLE_ROOM, order);
    return await matchMaker.reserveSeatFor(room, {}, { entityId: order.entityId });
  } catch (err) {
    console.error(`battle setup failed: ${(err as Error).message}`);
    stopFighting(order.entityId);
    return null;
  }
}
