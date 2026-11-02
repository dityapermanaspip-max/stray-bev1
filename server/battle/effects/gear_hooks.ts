import type { BattleCore } from '../core.ts';
import { isAlive } from '../rules.ts';
import type { BattleEntity, GearTrigger, MoveDef } from '../types.ts';
import type { UseContext } from './hit.ts';
import { HANDLERS } from './registry.ts';

// What gear adds to one strike, wear from hits, and triggered item effects.
// Weapon power, accuracy and vs_armor apply to moves that need the held weapon's type.
// Gloves add to `punch` moves, boots to `kick` moves. Armor stops physical damage only.
// Two hands: a single-weapon move uses the main hand only. A dual move says how in its effect params:
// hands "sum" adds the off-hand weapon's power (Cross Cut), hands "each" swings the hands in turn, one hit each
// (Twin Stab). The off hand counts only when the move needs its type (off_hand_type).

export type Hands = 'main' | 'sum' | 'each';
export const handsOf = (params: Record<string, unknown>): Hands =>
  params.hands === 'sum' || params.hands === 'each' ? params.hands : 'main';

export const usesOffHand = (actor: BattleEntity, move: MoveDef) =>
  actor.gear.offHand !== null && move.requires.some((r) => r.kind === 'off_hand_type' && r.value === actor.gear.offHandType);

// Weapon power for hit i of n. "each": the hands alternate, each hit carrying its own hand's whole power share.
export function handPower(actor: BattleEntity, move: MoveDef, hands: Hands, i: number, n: number): number {
  const main = usesWeapon(actor, move) ? actor.gear.weapon!.power : 0;
  const off = hands !== 'main' && usesOffHand(actor, move) ? actor.gear.offHand!.power : 0;
  if (hands === 'each' && off > 0) return ((i % 2 === 0 ? main : off) * 2) / n;
  return (main + off) / n;
}

export const usesWeapon = (actor: BattleEntity, move: MoveDef) =>
  actor.gear.weapon !== null && move.requires.some((r) => r.kind === 'weapon_type' && r.value === actor.weaponType);

// Glove and boot power (weapon power comes from handPower).
export function gearPower(actor: BattleEntity, move: MoveDef): number {
  const g = actor.gear;
  return (move.tags.includes('punch') ? g.punchPower : 0)
    + (move.tags.includes('kick') ? g.kickPower : 0);
}

export const gearAccuracy = (actor: BattleEntity, move: MoveDef) =>
  usesWeapon(actor, move) ? actor.gear.weapon!.accuracy : 1;

// 1 + bonus x the share of the target covered by that armor material tag.
export function vsArmorBonus(actor: BattleEntity, move: MoveDef, target: BattleEntity): number {
  if (!usesWeapon(actor, move)) return 1;
  let bonus = 1;
  for (const [tag, value] of Object.entries(actor.gear.weapon!.vsArmor)) bonus += value * (target.gear.coverage[tag] ?? 0);
  return bonus;
}

export const armorDefenseVs = (target: BattleEntity, move: MoveDef) =>
  move.damageKind === 'physical' ? target.gear.defense : 0;

// A landed hit wears the weapon(s) that struck and one armor piece of the target, picked by body share.
export function wearOnHit(core: BattleCore, actor: BattleEntity, move: MoveDef, target: BattleEntity, struck: { main: boolean; off: boolean } = { main: true, off: false }): void {
  const per = core.cfg.gear.wearPerHit;
  const add = (e: BattleEntity, id: string): void => {
    e.gear.wear.set(id, (e.gear.wear.get(id) ?? 0) + per);
  };
  const mainId = actor.gear.weapon?.pieceId;
  const offId = actor.gear.offHand?.pieceId;
  if (struck.main && mainId && usesWeapon(actor, move)) add(actor, mainId);
  if (struck.off && offId && usesOffHand(actor, move)) add(actor, offId);
  if (move.damageKind !== 'physical') return;
  const pieces = target.gear.armorPieces;
  const total = pieces.reduce((sum, p) => sum + p.share, 0);
  if (total <= 0) return;
  let roll = core.rng() * total;
  for (const p of pieces) {
    roll -= p.share;
    if (roll < 0) return add(target, p.id);
  }
}

// Throwing spends one of the readied stack; an empty hand can't throw again this fight.
export function spendThrown(e: BattleEntity, move: MoveDef): void {
  const w = e.gear.weapon;
  if (!w?.thrownItem || !usesWeapon(e, move)) return;
  w.thrownLeft--;
  e.gear.thrownSpent++;
  if (w.thrownLeft <= 0) e.weaponType = null;
}

// A move tagged throws_weapon (Javelin Throw, Axe Throw) sends the held weapon after its strike: the hand is empty
// for the rest of the fight (the weapon is picked up again afterwards; nothing is lost).
export const THROWS_WEAPON = 'throws_weapon';
export function dropThrownWeapon(e: BattleEntity, move: MoveDef): void {
  if (move.tags.includes(THROWS_WEAPON) && usesWeapon(e, move)) e.weaponType = null;
}

// Runs the owner's item effects for one trigger against a victim. Item moves never trigger more item effects.
export function fireGear(core: BattleCore, owner: BattleEntity, victim: BattleEntity, trigger: GearTrigger['trigger'], cause: MoveDef): void {
  if (cause.category === 'item') return;
  for (const t of owner.gear.triggers) {
    if (t.trigger !== trigger || !isAlive(owner) || !isAlive(victim)) continue;
    const handler = HANDLERS[t.effect.handler];
    if (!handler) continue;
    const use: UseContext = {
      core, actor: owner, move: t.move, level: 1, rates: { damage: 0, recovery: 0, cost: 0 }, channelTurns: null,
    };
    handler(use, victim, t.effect);
  }
}
