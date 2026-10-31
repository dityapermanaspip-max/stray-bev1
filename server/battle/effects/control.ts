import { levelMult } from '../damage.ts';
import { control, NONE, turnsOf, type Handler } from './hit.ts';

// Control handlers: push, stun, silence, taunt, bind, disable a body part, drain stamina.

export const knockback: Handler = (use, target, effect) =>
  control(use, target, effect, 'knockback', () => {
    target.atb = 0;
    if (target.phase === 'ready') target.phase = 'filling';
  });

export const stun: Handler = (use, target, effect) => {
  if (use.core.find(target, 'stun_immune') || use.core.find(target, 'stun')) return NONE;
  return control(use, target, effect, 'stun', () => {
    target.effects.push({ kind: 'stun', remaining: turnsOf(effect) });
  });
};

export const silence: Handler = (use, target, effect) =>
  control(use, target, effect, 'silence', () => {
    use.core.replace(target, { kind: 'silence', remaining: turnsOf(effect) }, (f) => f.kind === 'silence');
  });

export const taunt: Handler = (use, target, effect) =>
  control(use, target, effect, 'taunt', () => {
    use.core.replace(target, { kind: 'taunt', byId: use.actor.id, remaining: turnsOf(effect) }, (f) => f.kind === 'taunt');
  });

// The caster holds; the target cannot use moves while the hold lasts.
// The hold breaks on the move's broken_by tags, on the caster going down, or when its turns run out.
export const bind: Handler = (use, target, effect) => {
  const { core, actor, move } = use;
  if (target === actor) return NONE;
  return control(use, target, effect, 'bind', () => {
    const remaining = turnsOf(effect);
    core.replace(target, { kind: 'bind', byId: actor.id, remaining }, (f) => f.kind === 'bind');
    core.replace(actor, { kind: 'hold', move: move.name, targetId: target.id, remaining, brokenBy: move.brokenBy }, (f) => f.kind === 'hold');
    core.say(target, 'status.bind.start');
  });
};

// Moves that need the part cannot be used for a few turns.
export const disablePart: Handler = (use, target, effect) => {
  const part = String(effect.params.part ?? '');
  if (!part || !target.bodyParts.includes(part)) return NONE;
  return control(use, target, effect, 'disable_part', () => {
    use.core.replace(target, { kind: 'disable_part', part, remaining: turnsOf(effect) }, (f) => f.kind === 'disable_part' && f.part === part);
  });
};

// Removes a share of the target's max stamina. The target sees only its body tier change.
export const drain: Handler = (use, target, effect) =>
  control(use, target, effect, 'drain', () => {
    const share = Number(effect.params.share ?? 0) * levelMult(use.rates.damage, use.level);
    use.core.spend(target, 'stamina', target.derived.maxStamina * share);
  });
