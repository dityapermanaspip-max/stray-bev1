import type { BattleCore } from '../core.ts';
import { isAlive } from '../rules.ts';
import type { BattleEntity, GearTrigger, MoveDef } from '../types.ts';
import type { UseContext } from './hit.ts';
import { HANDLERS } from './registry.ts';

// What gear adds to one strike, wear from hits, and triggered item effects.
// Weapon power, accuracy and vs_armor apply to moves that need the held weapon's type.
// Gloves add to `punch` moves, boots to `kick` moves. Armor stops physical damage only.

export const usesWeapon = (actor: BattleEntity, move: MoveDef) =>
  actor.gear.weapon !== null && move.requires.some((r) => r.kind === 'weapon_type' && r.value === actor.weaponType);

export function gearPower(actor: BattleEntity, move: MoveDef): number {
  const g = actor.gear;
  return (usesWeapon(actor, move) ? g.weapon!.power : 0)
    + (move.tags.includes('punch') ? g.punchPower : 0)
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

// A landed hit wears the weapon used and one armor piece of the target, picked by body share.
export function wearOnHit(core: BattleCore, actor: BattleEntity, move: MoveDef, target: BattleEntity): void {
  const per = core.cfg.gear.wearPerHit;
  const add = (e: BattleEntity, id: string): void => {
    e.gear.wear.set(id, (e.gear.wear.get(id) ?? 0) + per);
  };
  const weaponId = actor.gear.weapon?.pieceId;
  if (weaponId && usesWeapon(actor, move)) add(actor, weaponId);
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
