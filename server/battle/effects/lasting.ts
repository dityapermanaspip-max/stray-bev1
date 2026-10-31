import { levelMult, luckRange } from '../damage.ts';
import { isAlive } from '../rules.ts';
import type { BattleEntity } from '../types.ts';
import { APPLIED, NONE, rollStatus, turnsOf, type Handler, type UseContext } from './hit.ts';
import type { EffectDef } from '../types.ts';

// Effects that last: guard, buffs, damage over time, heal over time, channel.

export const damageOverTime: Handler = (use, target, effect) => {
  const { core, actor } = use;
  const name = String(effect.params.status ?? '');
  const status = core.data.statuses.get(name);
  if (!status || !isAlive(target) || !rollStatus(use, target, effect, name)) return NONE;

  const turns = turnsOf(effect);
  const total = effect.power * levelMult(use.rates.damage, use.level) * core.resistance(target, 'status', name);
  const dot = { kind: 'dot' as const, status: name, perTick: total / turns, remaining: turns, sourceId: actor.id };
  if (status.stackRule === 'strongest') {
    const current = target.effects.find((f) => f.kind === 'dot' && f.status === name);
    if (current && current.kind === 'dot' && current.perTick * current.remaining >= total) return NONE;
    core.replace(target, dot, (f) => f.kind === 'dot' && f.status === name);
  } else {
    target.effects.push(dot);
  }
  core.emit({ type: 'status', entity: target.id, status: name, phase: 'start' });
  core.say(target, `status.${name}.start`);
  return APPLIED;
};

// Marks the move as channeled. The heal that follows is held by the caster.
export const channel: Handler = (use, _target, effect) => {
  use.channelTurns = turnsOf(effect);
  return APPLIED;
};

// No instant heal. Self heal is a HoT that keeps ticking when hit (strongest only).
// Healing someone else becomes a channel on the caster that damage can break.
export const healOverTime: Handler = (use, target, effect) => {
  const { core, actor, move } = use;
  if (!isAlive(target)) return NONE;
  const total =
    effect.power * levelMult(use.rates.damage, use.level) * core.cfg.combat.healInCombatEfficiency;

  if (use.channelTurns !== null && target !== actor) {
    const turns = use.channelTurns;
    core.replace(
      actor,
      { kind: 'channel', move: move.name, targetId: target.id, perTick: total / turns, remaining: turns, brokenBy: move.brokenBy, paid: false },
      (f) => f.kind === 'channel',
    );
    core.emit({ type: 'status', entity: actor.id, status: 'channel', phase: 'start' });
    return APPLIED;
  }

  const turns = turnsOf(effect);
  const current = core.find(target, 'hot');
  if (current && current.perTick * current.remaining >= total) return APPLIED;
  core.replace(
    target,
    { kind: 'hot', perTick: total / turns, remaining: turns, sourceId: actor.id, move: move.name, paid: false },
    (f) => f.kind === 'hot',
  );
  core.emit({ type: 'status', entity: target.id, status: 'heal_over_time', phase: 'start' });
  return APPLIED;
};

// params.hits: the guard ends after that many blocks (a redirect that cuts the next hit).
export const guard: Handler = (use, target, effect) => {
  const { core, move } = use;
  const reduction = Math.min(
    core.cfg.combat.guardReductionCap,
    effect.power * levelMult(use.rates.damage, use.level),
  );
  const resist = Array.isArray(effect.params.resist) ? effect.params.resist.map(String) : [];
  const hitsLeft = effect.params.hits === undefined ? null : Math.max(1, Number(effect.params.hits));
  core.replace(target, { kind: 'guard', move: move.name, reduction, remaining: turnsOf(effect), resist, hitsLeft }, (f) => f.kind === 'guard');
  return APPLIED;
};

// params: stat; mult or mult_range; add or add_range (ranges use luck_skew); self (apply to the user); pays_on 'dodge'.
function statModifier(use: UseContext, target: BattleEntity, effect: EffectDef): ReturnType<Handler> {
  const p = effect.params;
  const recipient = p.self ? use.actor : target;
  const stat = String(p.stat ?? '') as keyof BattleEntity['derived'];
  if (!(stat in recipient.derived) || !isAlive(recipient)) return NONE;
  const roll = (range: unknown) => luckRange(range, use.core.rng(), use.actor.stats.luck, Number(p.luck_skew ?? 0));
  const mult = roll(p.mult_range) ?? Number(p.mult ?? 1);
  const add = roll(p.add_range) ?? Number(p.add ?? 0);
  const paysOnDodge = p.pays_on === 'dodge';
  use.core.replace(
    recipient,
    { kind: 'buff', stat, mult, add, remaining: turnsOf(effect), move: paysOnDodge ? use.move.name : null, paysOnDodge },
    (f) => f.kind === 'buff' && f.stat === stat,
  );
  return APPLIED;
}

export const buff: Handler = (use, target, effect) => statModifier(use, target, effect);

export const debuff: Handler = (use, target, effect) =>
  rollStatus(use, target, effect, 'debuff') ? statModifier(use, target, effect) : NONE;
