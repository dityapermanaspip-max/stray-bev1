import { baseRef } from '../interior/interior_ref.ts';
import { applyTraits } from '../growth/traits.ts';
import { matchMaker } from '@colyseus/core';
import { growerEntity } from '../battle/from_state.ts';
import { placeFoes } from '../battle/formation.ts';
import { BattleInstance } from '../battle/instance.ts';
import type { BattleEntity } from '../battle/types.ts';
import { loadEntityState, type EntityState } from '../data/entity_load.ts';
import { fieldRing } from '../data/field_repo.ts';
import { tileAt } from '../field/types.ts';
import { loadInventory } from '../data/item_repo.ts';
import { mealActive, mealCosts } from '../food/food.ts';
import { loadMeal } from '../food/food_service.ts';
import type { Inventory } from '../inventory/bag.ts';
import { buildCombatGear } from '../inventory/combat_gear.ts';
import { buildCreature } from '../sim/combatants.ts';
import type { Foe } from '../world/encounter.ts';
import { BATTLE_ROOM } from '../../shared/battle.ts';
import { startFighting, stopFighting } from '../util/entity_lock.ts';
import { createRng } from '../util/rng.ts';
import { gridFor, type GameWorld } from './world.ts';
import { weakenedProgress } from '../boss/boss_rules.ts';

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
  vices: Map<string, EntityState>; // battle entity id (= entity id) -> a vice's saved state, so it grows and is saved
  ground: { biome: string; terrain: string }; // the field tile the fight started on: the board is made of it
};

export async function setUpFight(world: GameWorld, order: BattleOrder): Promise<Fight> {
  const { cfg } = world.data;
  const [state, inventory, meal, ring] = await Promise.all([
    loadEntityState(world.pool, order.entityId), loadInventory(world.pool, order.entityId), loadMeal(world.pool, order.entityId),
    fieldRing(world.pool, baseRef(order.fieldRef)), // a room's creatures are its field's
  ]);
  const player = growerEntity(cfg, {
    id: order.entityId, kind: 'player', side: 'party', slot: state.slot, speaker: 'self', controller: 'player',
    progress: state.progress, loadout: state.loadout, bodyParts: state.bodyParts, body: state.body,
    gear: buildCombatGear(cfg, world.catalog, inventory),
  });
  for (const [k, m] of state.raceResist) player.resist.set(k, (player.resist.get(k) ?? 1) * m); // hidden race resistances
  applyTraits(player, state.traits); // hidden trait resistances and stat additions
  if (mealActive(cfg, meal, Date.now())) player.costMult = mealCosts(world.catalog.get(meal.item)); // hidden food effect
  const roll = createRng((order.seed ^ 0x5bd1e995) >>> 0); // creatures rolled from the battle seed
  const slots = placeFoes(cfg.formation, order.foes.length); // front first; an encounter may name its own slots
  const vices = new Map<string, EntityState>();
  const foes = await Promise.all(order.foes.slice(0, slots.length).map(async (f, i) => {
    const slot = f.slot ?? slots[i];
    if (f.vice) {
      const vs = await loadEntityState(world.pool, f.vice.id); // a named vice fights as saved and grows like a player
      vices.set(f.vice.id, vs);
      return growerEntity(cfg, {
        id: f.vice.id, kind: 'named', side: 'enemy', slot, speaker: 'generic', controller: 'ai',
        progress: vs.progress, loadout: vs.loadout, bodyParts: vs.bodyParts, body: null,
      });
    }
    if (f.boss) {
      const bs = await loadEntityState(world.pool, f.boss.id); // full health every attempt, weakened by keys; no growth here
      return growerEntity(cfg, {
        id: f.boss.id, kind: 'boss', side: 'enemy', slot, speaker: 'generic', controller: 'ai',
        progress: weakenedProgress(bs.progress, f.boss.weaken), loadout: bs.loadout, bodyParts: bs.bodyParts, body: null,
      });
    }
    const def = world.species.get(f.species);
    if (!def) throw new Error(`unknown species ${f.species}`);
    return buildCreature(cfg, def, i + 1, f.corrupted, ring ?? cfg.rings.count, roll, slot);
  }));
  const instance = new BattleInstance(world.data, {
    entities: [player, ...foes],
    progress: new Map([[order.entityId, state.progress], ...[...vices].map(([id, v]) => [id, v.progress] as const)]),
    summonerSides: new Set(),
    seed: order.seed,
  });
  const field = await gridFor(world, order.fieldRef);
  const tile = field ? tileAt(field.grid, order.x, order.y) : undefined;
  const ground = { biome: tile?.biome ?? 'meadow', terrain: tile?.terrain ?? 'grass' };
  return { order, instance, player, foes, state, inventory, vices, ground };
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
    releaseFight(order);
    return null;
  }
}

// The player and any vice of the order are free again (battle over or never set up).
export function releaseFight(order: BattleOrder): void {
  stopFighting(order.entityId);
  for (const f of order.foes) if (f.vice) stopFighting(f.vice.id);
}
