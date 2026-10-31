import type { BattleCore } from '../core.ts';
import { growthRates } from '../damage.ts';
import { payMoveExp } from '../exp.ts';
import { isAlive } from '../rules.ts';
import type { ActiveEffect, BattleEntity, EffectDef, MoveDef } from '../types.ts';
import { APPLIED, strike, turnsOf, type Handler, type UseContext } from './hit.ts';
import { HANDLERS } from './registry.ts';

// Counter stances. The stance waits for a trigger (being hit, dodging, or a status landing),
// then strikes back once at the attacker. No trigger = no counter and no exp.
// Params: trigger (hit | dodge | status), tags (attacker move needs one; empty = any),
// status (for trigger status), take (share of the hit still taken), momentum (share of the
// incoming hit added to the counter's power), accuracy/crit_bonus/power_range for the strike,
// reply (one extra effect on the attacker: {handler, power, duration_turns, chance, params}).

type Counter = Extract<ActiveEffect, { kind: 'counter' }>;

function replyOf(raw: unknown): EffectDef | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    handler: String(r.handler ?? ''),
    power: Number(r.power ?? 0),
    durationTurns: r.duration_turns === undefined ? null : Number(r.duration_turns),
    chance: Number(r.chance ?? 1),
    params: (r.params as Record<string, unknown>) ?? {},
  };
}

export const counterStance: Handler = (use, target, effect) => {
  const p = effect.params;
  const stance: Counter = {
    kind: 'counter',
    move: use.move.name,
    trigger: String(p.trigger ?? 'hit'),
    tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
    status: typeof p.status === 'string' ? p.status : null,
    take: Number(p.take ?? 1),
    momentum: Number(p.momentum ?? 0),
    power: effect.power,
    params: p,
    reply: replyOf(p.reply),
    remaining: turnsOf(effect),
  };
  use.core.replace(target, stance, (f) => f.kind === 'counter');
  use.core.emit({ type: 'status', entity: target.id, status: 'counter', phase: 'start' });
  return APPLIED;
};

// The stance that would answer this attack, if any. Used before damage to apply `take`.
export function readyCounter(core: BattleCore, owner: BattleEntity, attackMove: MoveDef, trigger: string, status: string | null = null): Counter | null {
  const c = core.find(owner, 'counter');
  if (!c || c.trigger !== trigger || !isAlive(owner)) return null;
  if (trigger === 'status') return c.status === status ? c : null;
  return c.tags.length === 0 || c.tags.some((t) => attackMove.tags.includes(t)) ? c : null;
}

// Fires the stance once: strike back (power + momentum), apply the reply, pay exp.
export function fireCounter(core: BattleCore, owner: BattleEntity, attacker: BattleEntity, c: Counter, incoming: number): void {
  owner.effects = owner.effects.filter((f) => f !== c);
  if (!isAlive(owner) || !isAlive(attacker)) return;
  const move = core.data.moves.get(c.move);
  if (!move) return;
  const use: UseContext = {
    core, actor: owner, move, level: owner.moveLevels.get(move.name) ?? 1, rates: growthRates(core.cfg, move), channelTurns: null,
  };
  core.emit({ type: 'counter', entity: owner.id, move: move.name, target: attacker.id });
  const own = `use.sig.${move.name}.counter`;
  core.say(owner, core.data.lines.has(own) ? own : 'counter.fire');

  const power = c.power + c.momentum * incoming;
  const hit = power > 0 ? strike(use, attacker, power, c.params) : APPLIED;
  const tags = [...hit.tags];
  if (c.reply && hit.outcome !== 'miss' && isAlive(attacker)) {
    const handler = HANDLERS[c.reply.handler];
    if (handler) tags.push(...handler(use, attacker, c.reply).tags);
  }
  core.interrupt(attacker, tags.filter((t) => move.gives.includes(t)));

  const outcome = hit.outcome === 'crit' ? 'critical' : hit.outcome === 'miss' ? 'miss' : 'hit';
  payMoveExp(core, owner, move.name, outcome, attacker);
  if (hit.killed && attacker.corrupted) payMoveExp(core, owner, move.name, 'kill', attacker);
}

// Using any move drops a waiting stance.
export function dropStance(core: BattleCore, e: BattleEntity): void {
  if (!core.find(e, 'counter')) return;
  e.effects = e.effects.filter((f) => f.kind !== 'counter');
  core.emit({ type: 'status', entity: e.id, status: 'counter', phase: 'end' });
}
