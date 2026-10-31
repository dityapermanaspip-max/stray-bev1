import type { BodyResource } from '../config/balance.ts';
import type { Progress } from '../growth/level_up.ts';
import type { Derived } from '../stats/derived.ts';
import type { Rng } from '../util/rng.ts';
import { bodyTier, isAlive } from './rules.ts';
import type { ActiveEffect, BattleData, BattleEntity, BattleEvent, Side } from './types.ts';

// Shared battle state and the only functions that change hp, stamina, and mana.

const RESOURCES: BodyResource[] = ['hp', 'stamina', 'mana'];
const MAX_KEY: Record<BodyResource, keyof Derived> = { hp: 'maxHp', stamina: 'maxStamina', mana: 'maxMana' };

export class BattleCore {
  events: BattleEvent[] = [];
  readonly data: BattleData;
  readonly entities: BattleEntity[];
  readonly rng: Rng;
  readonly progress: Map<string, Progress>; // hidden, growing entities only
  readonly summonerSides: Set<Side>; // hidden

  constructor(
    data: BattleData,
    entities: BattleEntity[],
    rng: Rng,
    progress: Map<string, Progress>,
    summonerSides: Set<Side>,
  ) {
    this.data = data;
    this.entities = entities;
    this.rng = rng;
    this.progress = progress;
    this.summonerSides = summonerSides;
  }

  get cfg() {
    return this.data.cfg;
  }

  byId(id: string): BattleEntity | undefined {
    return this.entities.find((e) => e.id === id);
  }

  emit(event: BattleEvent): void {
    this.events.push(event);
  }

  say(entity: BattleEntity, key: string, tier = 0): void {
    if (!entity.speaker) return;
    const line = this.data.lines.pick(this.rng, key, tier, entity.speaker);
    if (!line) return;
    this.emit({ type: 'line', entity: entity.id, speaker: entity.speaker, key, tier, ...line });
  }

  // Derived stat with active buffs and debuffs applied (multiply, then add), plus worn gear effects.
  stat(entity: BattleEntity, stat: keyof Derived): number {
    const buffed = entity.effects.reduce(
      (value, f) => (f.kind === 'buff' && f.stat === stat ? value * f.mult + f.add : value),
      entity.derived[stat],
    );
    return buffed + (entity.gear.statAdd[stat] ?? 0);
  }

  resistance(entity: BattleEntity, kind: string, id: string | null): number {
    if (!id) return 1;
    return entity.resist.get(`${kind}:${id}`) ?? 1;
  }

  find<K extends ActiveEffect['kind']>(entity: BattleEntity, kind: K): Extract<ActiveEffect, { kind: K }> | undefined {
    return entity.effects.find((f) => f.kind === kind) as Extract<ActiveEffect, { kind: K }> | undefined;
  }

  replace(entity: BattleEntity, effect: ActiveEffect, same: (f: ActiveEffect) => boolean): void {
    entity.effects = entity.effects.filter((f) => !same(f));
    entity.effects.push(effect);
  }

  damage(target: BattleEntity, amount: number, sourceId: string, outcome: 'hit' | 'crit'): { killed: boolean } {
    if (!isAlive(target) || amount <= 0) return { killed: false };
    target.hp = Math.max(0, target.hp - amount);
    this.emit({ type: 'damage', source: sourceId, target: target.id, amount, outcome });
    this.updateTiers(target);
    if (target.hp > 0) return { killed: false };
    target.phase = 'downed';
    target.action = null;
    target.queued = null;
    target.effects = [];
    this.emit({ type: 'downed', entity: target.id });
    return { killed: true };
  }

  // Returns the amount actually healed (shown to the client as a number).
  heal(target: BattleEntity, amount: number): number {
    if (!isAlive(target) || amount <= 0) return 0;
    const healed = Math.min(Math.round(amount), target.derived.maxHp - target.hp);
    if (healed <= 0) return 0;
    target.hp += healed;
    this.emit({ type: 'heal', target: target.id, amount: healed });
    this.updateTiers(target);
    return healed;
  }

  spend(entity: BattleEntity, resource: 'stamina' | 'mana', amount: number): void {
    entity[resource] = Math.max(0, entity[resource] - amount);
    this.updateTiers(entity);
  }

  updateTiers(entity: BattleEntity): void {
    for (const resource of RESOURCES) {
      const tier = bodyTier(this.cfg, resource, entity[resource], entity.derived[MAX_KEY[resource]]);
      if (tier === entity.tiers[resource]) continue;
      entity.tiers[resource] = tier;
      this.emit({ type: 'tier', entity: entity.id, resource, tier });
      if (isAlive(entity)) this.say(entity, `body.${resource}`, tier);
    }
  }

  // A bind only holds while its caster is standing and still holding this target.
  isBound(entity: BattleEntity): boolean {
    const bind = this.find(entity, 'bind');
    if (!bind) return false;
    const holder = this.byId(bind.byId);
    return !!holder && isAlive(holder) && holder.effects.some((f) => f.kind === 'hold' && f.targetId === entity.id);
  }

  // Breaks channels and holds whose broken_by tags were given to this entity. Tags come from data.
  interrupt(target: BattleEntity, tags: string[]): void {
    if (tags.length === 0) return;
    const broken = target.effects.filter(
      (f) => (f.kind === 'channel' || f.kind === 'hold') && f.brokenBy.some((t) => tags.includes(t)),
    );
    if (broken.length === 0) return;
    target.effects = target.effects.filter((f) => !broken.includes(f));
    for (const f of broken) {
      if (f.kind !== 'channel' && f.kind !== 'hold') continue;
      this.emit({ type: 'interrupt', entity: target.id, move: f.move });
      if (f.kind === 'hold') this.release(f.targetId);
    }
  }

  private release(boundId: string): void {
    const bound = this.byId(boundId);
    if (!bound || !this.find(bound, 'bind')) return;
    bound.effects = bound.effects.filter((f) => f.kind !== 'bind');
    this.emit({ type: 'status', entity: bound.id, status: 'bind', phase: 'end' });
    this.say(bound, 'status.bind.end');
  }
}
