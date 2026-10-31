import type { BattleCore } from '../core.ts';
import {
  attackStat,
  baseDamage,
  defenseReduction,
  finalDamage,
  hitBase,
  levelMult,
  luckRange,
  statMult,
  type ScaledRates,
} from '../damage.ts';
import { payMoveExp } from '../exp.ts';
import { isAlive } from '../rules.ts';
import type { BattleEntity, EffectDef, HitOutcome, MoveDef } from '../types.ts';
import { fireCounter, readyCounter } from './counter.ts';
import { armorDefenseVs, fireGear, gearAccuracy, gearPower, vsArmorBonus, wearOnHit } from './gear_hooks.ts';

// Shared handler types, the damage handler, and the control wrapper used by control effects.

export type UseContext = {
  core: BattleCore;
  actor: BattleEntity;
  move: MoveDef;
  level: number;
  rates: ScaledRates;
  channelTurns: number | null; // set by the channel effect for later effects of the same move
};

export type EffectResult = { tags: string[]; outcome: HitOutcome | null; killed: boolean; applied: boolean };
export type Handler = (use: UseContext, target: BattleEntity, effect: EffectDef) => EffectResult;

export const NONE: EffectResult = { tags: [], outcome: null, killed: false, applied: false };
export const APPLIED: EffectResult = { tags: [], outcome: null, killed: false, applied: true };

export const turnsOf = (effect: EffectDef) => Math.max(1, effect.durationTurns ?? 1);

// Effect chance, then the target's status resistance (0 = immune, line once per fight).
export function rollStatus(use: UseContext, target: BattleEntity, effect: EffectDef, status: string): boolean {
  const { core } = use;
  if (core.rng() >= effect.chance) return false;
  if (core.resistance(target, 'status', status) > 0) return true;
  if (!target.immuneShown.has(status)) {
    target.immuneShown.add(status);
    core.say(use.actor, `immune.${status}`);
  }
  return false;
}

function guardResists(core: BattleCore, target: BattleEntity, tag: string): boolean {
  return core.find(target, 'guard')?.resist.includes(tag) ?? false;
}

// Guard reduces damage taken and earns exp only when it blocked something.
// A guard with a hit count (e.g. a redirect) ends after that many blocks.
function blockWithGuard(core: BattleCore, target: BattleEntity, amount: number, attacker: BattleEntity): number {
  const guard = core.find(target, 'guard');
  if (!guard) return 0;
  const blocked = Math.round(amount * guard.reduction);
  if (blocked <= 0) return 0;
  payMoveExp(core, target, guard.move, 'hit', attacker);
  if (guard.hitsLeft !== null && --guard.hitsLeft <= 0) {
    target.effects = target.effects.filter((f) => f !== guard);
  }
  return blocked;
}

// An evade buff earns exp only when its owner actually dodged.
function payDodge(core: BattleCore, target: BattleEntity, attacker: BattleEntity): void {
  for (const f of target.effects) {
    if (f.kind === 'buff' && f.paysOnDodge && f.move) payMoveExp(core, target, f.move, 'hit', attacker);
  }
}

// Power multiplier from params: luck-skewed random range, and a bonus against targets under an effect.
function powerMult(core: BattleCore, actor: BattleEntity, target: BattleEntity, params: Record<string, unknown>): number {
  const range = luckRange(params.power_range, core.rng(), actor.stats.luck, Number(params.luck_skew ?? 0));
  const marked = typeof params.bonus_vs_effect === 'string' && target.effects.some((f) => f.kind === params.bonus_vs_effect);
  return (range ?? 1) * (marked ? Number(params.bonus_mult ?? 1) : 1);
}

export function strike(use: UseContext, target: BattleEntity, power: number, params: Record<string, unknown>): EffectResult {
  const { core, actor, move } = use;
  const c = core.cfg.combat;
  const hits = Math.max(1, Number(params.hit_count ?? 1));
  const accuracy = Number(params.accuracy ?? 1) * gearAccuracy(actor, move);
  const critBonus = Number(params.crit_bonus ?? 0);
  const resistType = core.resistance(target, 'damage_type', move.damageType);
  const resistElement = core.resistance(target, 'element', move.element);
  const mult = powerMult(core, actor, target, params);
  const weaponPower = gearPower(actor, move);
  const typeBonus = vsArmorBonus(actor, move, target);
  const armor = defenseReduction(c, armorDefenseVs(target, move));
  let landed = false;
  let crit = false;
  let killed = false;

  for (let i = 0; i < hits && isAlive(target) && isAlive(actor); i++) {
    // One roll: below base*(1-dodge) hits, between that and base is a dodge, above base is a plain miss.
    const roll = core.rng();
    const base = hitBase(c, accuracy, core.stat(actor, 'accuracy'));
    if (roll >= base * (1 - Math.min(core.stat(target, 'dodgeChance'), c.dodgeCap))) {
      if (roll < base) {
        payDodge(core, target, actor);
        const evade = readyCounter(core, target, move, 'dodge');
        if (evade) fireCounter(core, target, actor, evade, 0);
        fireGear(core, target, actor, 'on_dodge', move);
      }
      continue;
    }
    landed = true;
    const isCrit = core.rng() < core.stat(actor, 'critChance') + critBonus;
    crit ||= isCrit;
    const raw = baseDamage({
      power: (power * mult) / hits,
      weaponPower: weaponPower / hits,
      ammoPower: 0,
      typeBonus,
      levelMult: levelMult(use.rates.damage, use.level),
      statMult: statMult(c, attackStat(move, actor.stats)),
      resistType,
      resistElement,
      defenseReduction: armor,
    });
    const amount = finalDamage(c, raw, isCrit, resistType * resistElement === 0);
    const counter = readyCounter(core, target, move, 'hit');
    const taken = counter ? Math.round(amount * counter.take) : amount;
    const dealt = taken - blockWithGuard(core, target, taken, actor);
    if (core.damage(target, dealt, actor.id, isCrit ? 'crit' : 'hit').killed) killed = true;
    wearOnHit(core, actor, move, target);
    if (counter) fireCounter(core, target, actor, counter, amount);
    fireGear(core, actor, target, 'on_hit', move);
    fireGear(core, target, actor, 'on_struck', move);
  }

  if (!landed) core.emit({ type: 'miss', actor: actor.id, target: target.id });
  return { tags: landed ? ['damage'] : [], outcome: !landed ? 'miss' : crit ? 'crit' : 'hit', killed, applied: landed };
}

export const damage: Handler = (use, target, effect) => strike(use, target, effect.power, effect.params);

// Control effects may carry near-zero damage. A miss cancels the control part.
export function control(use: UseContext, target: BattleEntity, effect: EffectDef, status: string, apply: () => void): EffectResult {
  const hit = effect.power > 0 ? strike(use, target, effect.power, effect.params) : APPLIED;
  if (hit.outcome === 'miss' || !isAlive(target)) return hit;
  if (guardResists(use.core, target, status) || !rollStatus(use, target, effect, status)) {
    return { ...hit, applied: hit.outcome !== null };
  }
  const reversal = readyCounter(use.core, target, use.move, 'status', status);
  if (reversal) {
    fireCounter(use.core, target, use.actor, reversal, 0);
    return { ...hit, applied: hit.outcome !== null };
  }
  apply();
  use.core.emit({ type: 'status', entity: target.id, status, phase: 'start' });
  return { ...hit, applied: true, tags: [...hit.tags, status] };
}
