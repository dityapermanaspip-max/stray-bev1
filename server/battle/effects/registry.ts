import { counterStance } from './counter.ts';
import { bind, disablePart, drain, knockback, silence, stun, taunt } from './control.ts';
import { damage, type Handler } from './hit.ts';
import { buff, channel, damageOverTime, debuff, guard, healOverTime } from './lasting.ts';

// handler_key -> handler. Moves using an unknown handler cannot be used in battle.
export const HANDLERS: Record<string, Handler> = {
  damage,
  damage_over_time: damageOverTime,
  heal_over_time: healOverTime,
  channel,
  guard,
  stun,
  silence,
  knockback,
  buff,
  debuff,
  taunt,
  bind,
  disable_part: disablePart,
  drain,
  counter: counterStance,
};
