import type { Progress } from '../growth/level_up.ts';
import { createRng, pick } from '../util/rng.ts';
import { chooseAction, usableMoves } from './ai.ts';
import { awaitsCommand, idleAction, lockedTarget, lockKind, setLock, turnOrder } from './command.ts';
import { BattleCore } from './core.ts';
import { growthRates, levelMult } from './damage.ts';
import type { EffectResult, UseContext } from './effects/hit.ts';
import { dropStance } from './effects/counter.ts';
import { dropThrownWeapon, spendThrown } from './effects/gear_hooks.ts';
import { HANDLERS } from './effects/registry.ts';
import { payMoveExp } from './exp.ts';
import { fleeRoll } from './flee.ts';
import { effectTurn } from './over_time.ts';
import { entityCost, expandTargets, isAlive, strayTargets, validTargets } from './rules.ts';
import type { BattleData, BattleEntity, BattleEvent, MoveDef, PendingAction, Side } from './types.ts';

// One private battle. The server drives it with tick(ms); clients only submit actions.

export type BattleSetup = {
  entities: BattleEntity[];
  progress: Map<string, Progress>;
  summonerSides: Set<Side>;
  seed: number;
};

export class BattleInstance {
  private core: BattleCore;
  private stepMs = 0;
  private effectMs = 0;
  winner: Side | null = null;
  fled = false; // the party ran away: the fight is over with no winner

  constructor(data: BattleData, setup: BattleSetup) {
    this.core = new BattleCore(data, setup.entities, createRng(setup.seed), setup.progress, setup.summonerSides);
  }

  get entities(): readonly BattleEntity[] {
    return this.core.entities;
  }

  // Player intent. Validated here; the action runs when the gauge is full. No target: the remembered one
  // (command flow); a move that cannot reach it is refused and the turn stays open.
  submit(actorId: string, moveName: string, targetId = ''): string | null {
    const actor = this.core.byId(actorId);
    if (!actor || actor.controller !== 'player') return 'not_your_entity';
    if (!isAlive(actor) || this.winner) return 'cannot_act';
    const move = usableMoves(this.core, actor).find((m) => m.name === moveName);
    if (!move) return 'move_unusable';
    const target = targetId ? validTargets(this.core.entities, actor, move).find((e) => e.id === targetId) : lockedTarget(this.core, actor, move);
    if (!target) return 'bad_target';
    const kind = lockKind(move);
    if (kind) setLock(this.core, actor, kind, target.id);
    actor.lastMove = moveName;
    actor.queued = { move: moveName, targetIds: [target.id] };
    return null;
  }

  // The player's party tries to run (battle/flee.ts): needs a full gauge, never from the boss. 'fled' ends the fight;
  // 'failed' spends the turn (the gauge starts again); anything else is a refusal and nothing changes.
  flee(actorId: string): 'fled' | 'failed' | 'cannot' | 'boss' {
    const actor = this.core.byId(actorId);
    if (!actor || actor.controller !== 'player' || !isAlive(actor) || actor.phase !== 'ready' || this.winner || this.fled) return 'cannot';
    const alive = (side: Side) => this.core.entities.filter((x) => x.side === side && isAlive(x));
    if (alive('enemy').some((x) => x.kind === 'boss')) return 'boss';
    const runner = (x: BattleEntity) => ({ speed: this.core.stat(x, 'speed'), luck: x.stats.luck });
    if (fleeRoll(this.core.cfg.combat.flee, alive(actor.side).map(runner), alive(actor.side === 'party' ? 'enemy' : 'party').map(runner), this.core.rng)) {
      this.fled = true;
      return 'fled';
    }
    actor.queued = null;
    this.refill(actor);
    return 'failed';
  }

  // A turn spent on something outside the moves (a gear swap, battle_gear.ts): needs a full gauge; `change` runs, then the gauge starts again.
  restock(actorId: string, change: () => boolean): boolean {
    const actor = this.core.byId(actorId);
    if (!actor || actor.controller !== 'player' || !isAlive(actor) || actor.phase !== 'ready' || this.winner || this.fled) return false;
    if (!change()) return false;
    actor.queued = null;
    this.refill(actor);
    return true;
  }

  // Change the remembered target without using a move. Same reach check as a move's target (any usable move of that kind).
  setTarget(actorId: string, targetId: string): string | null {
    const actor = this.core.byId(actorId);
    const target = this.core.byId(targetId);
    if (!actor || actor.controller !== 'player' || !target || !isAlive(target) || this.winner) return 'bad_target';
    setLock(this.core, actor, target.side === actor.side ? 'ally' : 'foe', target.id);
    return null;
  }

  turnOrder(): string[] {
    return turnOrder(this.core);
  }

  // What a fighter could use right now, and on whom (for the move menu).
  options(actorId: string): { move: string; targets: string[] }[] {
    const actor = this.core.byId(actorId);
    if (!actor || !isAlive(actor) || this.winner) return [];
    return usableMoves(this.core, actor).map((m) => ({ move: m.name, targets: validTargets(this.core.entities, actor, m).map((t) => t.id) }));
  }

  tick(dtMs: number): BattleEvent[] {
    const step = this.core.cfg.combat.atbTickMs;
    this.stepMs += dtMs;
    while (this.stepMs >= step && !this.winner && !this.fled) {
      this.stepMs -= step;
      if (this.core.cfg.combat.commandMode === 'wait' && this.core.entities.some((e) => awaitsCommand(this.core, e))) continue;
      this.step(step);
    }
    const events = this.core.events;
    this.core.events = [];
    return events;
  }

  private step(ms: number): void {
    const c = this.core.cfg.combat;
    this.effectMs += ms;
    while (this.effectMs >= c.effectTurnMs) {
      this.effectMs -= c.effectTurnMs;
      effectTurn(this.core);
    }
    for (const entity of this.core.entities) {
      for (const [move, left] of entity.cooldowns) {
        if (left <= ms) entity.cooldowns.delete(move);
        else entity.cooldowns.set(move, left - ms);
      }
      if (isAlive(entity) && !this.winner) this.advance(entity, ms);
      this.checkEnd();
    }
  }

  private advance(e: BattleEntity, ms: number): void {
    const c = this.core.cfg.combat;
    if (this.core.find(e, 'stun') && (e.phase === 'filling' || e.phase === 'winding')) return;

    if (e.phase === 'filling') {
      e.atb = Math.min(c.atbFull, e.atb + this.core.stat(e, 'speed') * c.atbFillPerSpeed);
      if (e.atb >= c.atbFull) e.phase = 'ready';
    }
    if (e.phase === 'ready') {
      const action = e.controller === 'ai' ? this.aiAction(e) : e.queued ?? this.idleAction(e, ms);
      if (action) this.begin(e, action);
      else if (e.controller === 'ai' || usableMoves(this.core, e).length === 0) this.refill(e); // nothing usable: the turn passes
      return;
    }
    if (e.phase === 'winding' || e.phase === 'recovering') {
      e.timerMs -= ms;
      if (e.timerMs > 0) return;
      if (e.phase === 'winding') this.resolve(e);
      else this.refill(e);
    }
  }

  private aiAction(e: BattleEntity): PendingAction | null {
    return chooseAction(this.core, e, this.core.cfg.aiHealBelowTier);
  }

  // A commanded fighter that waits too long repeats its last move on its locked target (the AI picks if it cannot).
  private idleAction(e: BattleEntity, ms: number): PendingAction | null {
    const limit = this.core.cfg.combat.idleAutoMs;
    e.idleMs = (e.idleMs ?? 0) + ms;
    if (limit <= 0 || e.idleMs < limit) return null;
    return idleAction(this.core, e, () => this.aiAction(e));
  }

  private refill(e: BattleEntity): void {
    e.idleMs = 0;
    e.phase = 'filling';
    e.atb = 0;
  }

  private begin(e: BattleEntity, action: PendingAction): void {
    const move = this.core.data.moves.get(action.move)!;
    dropStance(this.core, e); // acting ends a waiting counter stance
    if (move.cooldown) e.cooldowns.set(move.name, move.cooldown * 1000);
    const { cost, staminaShare } = entityCost(this.core.cfg, e, move);
    if (move.resource) this.core.spend(e, move.resource, cost);
    if (staminaShare > 0) this.core.spend(e, 'stamina', staminaShare);
    for (const req of move.requires) {
      if (req.kind !== 'ammo_type') continue;
      e.ammo.set(req.value, (e.ammo.get(req.value) ?? 0) - 1);
      e.gear.ammoSpent.set(req.value, (e.gear.ammoSpent.get(req.value) ?? 0) + 1);
    }
    spendThrown(e, move);
    e.queued = null;
    e.idleMs = 0;
    e.action = action;
    e.phase = 'winding';
    e.timerMs = move.windup * 1000;
    if (e.timerMs <= 0) this.resolve(e);
  }

  private resolve(e: BattleEntity): void {
    const core = this.core;
    const move = core.data.moves.get(e.action!.move)!;
    const level = e.moveLevels.get(move.name) ?? 1;
    const rates = growthRates(core.cfg, move);
    const chosen = this.retarget(e, move, e.action!);
    const targets = chosen ? strayTargets(core.cfg, core.rng, core.entities, e, move, expandTargets(core.entities, e, move, chosen)) : [];
    e.action = null;
    e.phase = 'recovering';
    e.timerMs = move.recovery * 1000 * levelMult(rates.recovery, level);
    if (targets.length === 0) return;

    core.emit({ type: 'use', actor: e.id, move: move.name, targets: targets.map((t) => t.id) });
    const use: UseContext = { core, actor: e, move, level, rates, channelTurns: null };
    for (const target of targets) {
      const results = move.effects.map((f) => HANDLERS[f.handler](use, target, f));
      const given = [...new Set(results.flatMap((r) => r.tags))].filter((t) => move.gives.includes(t));
      core.interrupt(target, given);
      this.afterTarget(e, move, target, results);
    }
    dropThrownWeapon(e, move);
  }

  // Lines and move exp for one target of one use.
  private afterTarget(e: BattleEntity, move: MoveDef, target: BattleEntity, results: EffectResult[]): void {
    const core = this.core;
    const outcomes = results.map((r) => r.outcome).filter((o) => o !== null);
    const killed = results.some((r) => r.killed);
    if (outcomes.length > 0) {
      const best = outcomes.includes('crit') ? 'crit' : outcomes.includes('hit') ? 'hit' : 'miss';
      const lineOutcome = killed ? 'kill' : best;
      if (lineOutcome !== 'hit') core.say(e, this.useLineKey(move, lineOutcome));
      payMoveExp(core, e, move.name, best === 'crit' ? 'critical' : best, target);
      if (killed && target.corrupted) payMoveExp(core, e, move.name, 'kill', target);
      return;
    }
    // No strike: stances, buffs, binds speak their own line if the move has one.
    const cast = `use.sig.${move.name}.cast`;
    if (core.data.lines.has(cast)) core.say(e, cast);
    // Guard and heal moves pay on block or delivery, elsewhere.
    if (move.category === 'guard' || move.category === 'heal') return;
    payMoveExp(core, e, move.name, results.some((r) => r.applied) ? 'hit' : 'miss', target);
  }

  // Pick order: signature, element, damage type.
  private useLineKey(move: MoveDef, outcome: string): string {
    const lines = this.core.data.lines;
    const signature = `use.sig.${move.name}.${outcome}`;
    if (lines.has(signature)) return signature;
    const element = move.element ? `use.${move.element}.${outcome}` : null;
    if (element && lines.has(element)) return element;
    return `use.${move.damageType}.${outcome}`;
  }

  // A target that fell during wind-up is replaced by another valid one.
  private retarget(e: BattleEntity, move: MoveDef, action: PendingAction): BattleEntity | undefined {
    const valid = validTargets(this.core.entities, e, move);
    const kept = valid.find((t) => t.id === action.targetIds[0]);
    if (kept) return kept;
    const next = pick(this.core.rng, valid);
    const kind = lockKind(move);
    if (next && kind && e.controller === 'player') setLock(this.core, e, kind, next.id); // the lock follows to the new pick
    return next;
  }

  private checkEnd(): void {
    if (this.winner) return;
    const standing = (side: Side) => this.core.entities.some((x) => x.side === side && isAlive(x));
    if (standing('party') && standing('enemy')) return;
    this.winner = standing('party') ? 'party' : 'enemy';
    this.core.emit({ type: 'end', winner: this.winner });
  }
}
