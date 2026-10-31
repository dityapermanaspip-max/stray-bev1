import type { BattleCore } from './core.ts';
import { defenseReduction } from './damage.ts';
import { payMoveExp } from './exp.ts';
import { isAlive } from './rules.ts';
import type { ActiveEffect, BattleEntity } from './types.ts';

// One effect turn: over-time ticks, then every duration counts down by one.

export function effectTurn(core: BattleCore): void {
  for (const entity of core.entities) {
    if (!isAlive(entity)) continue;
    for (const effect of [...entity.effects]) {
      if (!isAlive(entity)) break;
      tick(core, entity, effect);
    }
    if (isAlive(entity)) countDown(core, entity);
  }
}

function tick(core: BattleCore, entity: BattleEntity, effect: ActiveEffect): void {
  const c = core.cfg.combat;
  switch (effect.kind) {
    case 'dot': {
      const status = core.data.statuses.get(effect.status);
      const defense = status?.ignoresDefense ? 1 : 1 - defenseReduction(c, entity.gear.defense);
      core.damage(entity, Math.max(c.minDamage, Math.round(effect.perTick * defense)), effect.sourceId, 'hit');
      return;
    }
    case 'hot': {
      const healed = core.heal(entity, effect.perTick);
      if (healed > 0 && !effect.paid) payOnce(core, effect, effect.sourceId);
      return;
    }
    case 'channel': {
      const target = core.byId(effect.targetId);
      if (!target || !isAlive(target)) return;
      const healed = core.heal(target, effect.perTick);
      if (healed > 0 && !effect.paid) payOnce(core, effect, entity.id);
      return;
    }
  }
}

// Heal moves earn exp only when healing was delivered, once per cast.
function payOnce(core: BattleCore, effect: { move: string; paid: boolean }, casterId: string): void {
  effect.paid = true;
  const caster = core.byId(casterId);
  if (caster) payMoveExp(core, caster, effect.move, 'hit', null);
}

function countDown(core: BattleCore, entity: BattleEntity): void {
  const expired: ActiveEffect[] = [];
  for (const effect of entity.effects) {
    effect.remaining -= 1;
    if (effect.remaining <= 0) expired.push(effect);
  }
  if (expired.length === 0) return;
  entity.effects = entity.effects.filter((f) => !expired.includes(f));

  for (const effect of expired) {
    const status = statusName(effect);
    if (effect.kind === 'stun') {
      entity.effects.push({ kind: 'stun_immune', remaining: core.cfg.combat.stunImmunityTurns });
    }
    if (!status) continue;
    core.emit({ type: 'status', entity: entity.id, status, phase: 'end' });
    if (effect.kind === 'dot' || effect.kind === 'bind') core.say(entity, `status.${status}.end`);
  }
}

function statusName(effect: ActiveEffect): string | null {
  switch (effect.kind) {
    case 'dot':
      return effect.status;
    case 'hot':
      return 'heal_over_time';
    case 'stun':
    case 'silence':
    case 'taunt':
    case 'channel':
    case 'bind':
    case 'disable_part':
    case 'counter':
      return effect.kind;
    default:
      return null;
  }
}
