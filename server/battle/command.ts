import type { BattleCore } from './core.ts';
import { usableMoves } from './ai.ts';
import { isAlive, validTargets } from './rules.ts';
import { pick } from '../util/rng.ts';
import type { BattleEntity, MoveDef, PendingAction } from './types.ts';

// The command flow of a commanded fighter (the player, or the companion they steer): a remembered target per side,
// a remembered move, and the turn order the client lists. Rules in SYSTEMS.md, "Command flow".

type LockKind = 'foe' | 'ally';

// Which remembered target a move uses; self and group-ally moves use none.
export function lockKind(move: MoveDef): LockKind | null {
  if (move.target === 'one_ally') return 'ally';
  return move.target === 'self' || move.target === 'all_allies' ? null : 'foe';
}

export function setLock(core: BattleCore, actor: BattleEntity, kind: LockKind, id: string): void {
  if (actor.lock?.[kind] === id) return;
  actor.lock = { ...actor.lock, [kind]: id };
  core.emit({ type: 'lock', entity: actor.id, target: id });
}

// The target for a move sent without one: the remembered one while it lives; a random valid one when it died or was
// never set. A live lock the move cannot reach (melee behind a front row) gives null: the turn stays open.
export function lockedTarget(core: BattleCore, actor: BattleEntity, move: MoveDef): BattleEntity | null {
  const valid = validTargets(core.entities, actor, move);
  const kind = lockKind(move);
  if (!kind) return valid[0] ?? null;
  const held = core.byId(actor.lock?.[kind] ?? '');
  if (held && isAlive(held) && (held.side !== actor.side) === (kind === 'foe')) return valid.find((t) => t.id === held.id) ?? null;
  const chosen = pick(core.rng, valid);
  if (chosen) setLock(core, actor, kind, chosen.id);
  return chosen ?? null;
}

// After the idle time: the last move on the locked target, else whatever the AI would do.
export function idleAction(core: BattleCore, actor: BattleEntity, fallback: () => PendingAction | null): PendingAction | null {
  const last = usableMoves(core, actor).find((m) => m.name === actor.lastMove);
  const target = last && lockedTarget(core, actor, last);
  return last && target ? { move: last.name, targetIds: [target.id] } : fallback();
}

// A commanded fighter ready with a move to pick: wait mode stops the clock for it.
export const awaitsCommand = (core: BattleCore, e: BattleEntity) =>
  e.controller === 'player' && e.phase === 'ready' && !e.queued && usableMoves(core, e).length > 0;

// Who acts next: ready now first, then by time left until the gauge is full (a rough guess, never speed or gauge values).
export function turnOrder(core: BattleCore): string[] {
  const c = core.cfg.combat;
  const fillMs = (e: BattleEntity, atb: number) => ((c.atbFull - atb) / Math.max(0.01, core.stat(e, 'speed') * c.atbFillPerSpeed)) * c.atbTickMs;
  const eta = (e: BattleEntity) => {
    switch (e.phase) {
      case 'ready': return 0;
      case 'filling': return fillMs(e, e.atb);
      default: return Math.max(0, e.timerMs) + fillMs(e, 0);
    }
  };
  return core.entities.filter(isAlive).map((e) => ({ id: e.id, t: eta(e) })).sort((a, b) => a.t - b.t).map((x) => x.id);
}
