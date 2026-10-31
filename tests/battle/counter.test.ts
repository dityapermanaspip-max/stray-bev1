import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BattleCore } from '../../server/battle/core.ts';
import { growthRates } from '../../server/battle/damage.ts';
import type { UseContext } from '../../server/battle/effects/hit.ts';
import { HANDLERS } from '../../server/battle/effects/registry.ts';
import { createProgress } from '../../server/battle/factory.ts';
import { BattleInstance } from '../../server/battle/instance.ts';
import type { BattleEntity, BattleEvent, EffectDef, MoveDef } from '../../server/battle/types.ts';
import { createRng } from '../../server/util/rng.ts';
import { battleData, cfg, fighter, MOVES, move, stats } from '../fixtures/battle_data.ts';

const fx = (handler: string, power: number, durationTurns: number | null, params: Record<string, unknown> = {}): EffectDef =>
  ({ handler, power, durationTurns, chance: 1, params });
const stance = (name: string, power: number, params: Record<string, unknown>, cooldown: number | null = null) =>
  move({ name, category: 'guard', target: 'self', rowRule: 'any', cooldown, tags: ['growth.quick', 'punch'], effects: [fx('counter', power, 3, params)] });

const EXTRA: MoveDef[] = [
  move({ name: 'jab', tags: ['growth.quick', 'punch'], effects: [fx('damage', 10, null)] }),
  move({ name: 'snap_kick', tags: ['growth.quick', 'kick'], effects: [fx('damage', 10, null)] }),
  move({ name: 'grab', category: 'control', damageType: null, gives: [], brokenBy: ['damage'], effects: [fx('bind', 0, 2)] }),
  stance('cross_counter', 18, { trigger: 'hit', tags: ['punch'], take: 1, momentum: 0.5 }, 8),
  stance('reversal', 0, { trigger: 'status', status: 'bind', reply: { handler: 'bind', duration_turns: 2 } }),
  stance('slip_sweep', 8, { trigger: 'dodge', tags: [], take: 0 }),
];
const data = { ...battleData(), moves: new Map([...MOVES, ...EXTRA.map((m) => [m.name, m] as const)]) };
const sure = stats({ dex: 30, int: 30, luck: 0 });

function setup(entities: BattleEntity[], seed = 1) {
  const progress = new Map(entities.filter((e) => e.grows).map((e) => [e.id, createProgress(e.stats, [...e.moveLevels].map(([name, level]) => ({ name, level })))]));
  return new BattleCore(data, entities, createRng(seed), progress, new Set());
}

function use(core: BattleCore, actor: BattleEntity, target: BattleEntity, name: string) {
  const m = data.moves.get(name)!;
  const ctx: UseContext = { core, actor, move: m, level: 1, rates: growthRates(cfg, m), channelTurns: null };
  return m.effects.map((f) => HANDLERS[f.handler](ctx, target, f));
}

const counters = (events: BattleEvent[]) => events.filter((e) => e.type === 'counter');
const damageTo = (events: BattleEvent[], id: string) =>
  events.filter((e) => e.type === 'damage' && e.target === id).map((e) => (e.type === 'damage' ? e.amount : 0));

test('cross counter: take the full punch, then hit back harder with their momentum', () => {
  const a = fighter('a', 'enemy', { stats: sure, grows: false });
  const b = fighter('b', 'party', { stats: stats({ luck: 0, dex: 30, int: 30 }), moves: [{ name: 'cross_counter', level: 1 }] });
  const core = setup([b, a]);
  use(core, b, b, 'cross_counter');
  use(core, a, b, 'jab');
  const [taken] = damageTo(core.events, 'b');
  const [back] = damageTo(core.events, 'a');
  assert.equal(counters(core.events).length, 1);
  assert.ok(taken > 0, 'the full hit lands');
  assert.ok(back > taken, 'the counter hits harder');
  assert.equal(core.find(b, 'counter'), undefined, 'one counter per stance');
  assert.ok(core.progress.get('b')!.moves.get('cross_counter')!.exp > 0);
});

test('no punch, no counter, no exp', () => {
  const a = fighter('a', 'enemy', { stats: sure, grows: false });
  const b = fighter('b', 'party', { stats: stats({ luck: 0 }), moves: [{ name: 'cross_counter', level: 1 }] });
  const core = setup([b, a]);
  use(core, b, b, 'cross_counter');
  use(core, a, b, 'snap_kick');
  assert.equal(counters(core.events).length, 0);
  assert.ok(core.find(b, 'counter'), 'the stance still waits');
  assert.equal(core.progress.get('b')!.moves.get('cross_counter')!.exp, 0);
});

test('double cross counter: a counter punch can be countered', () => {
  const a = fighter('a', 'enemy', { stats: sure, moves: [{ name: 'cross_counter', level: 1 }] });
  const b = fighter('b', 'party', { stats: sure, moves: [{ name: 'cross_counter', level: 1 }] });
  const core = setup([b, a]);
  use(core, a, a, 'cross_counter');
  use(core, b, b, 'cross_counter');
  use(core, a, b, 'jab');
  assert.deepEqual(counters(core.events).map((e) => (e.type === 'counter' ? e.entity : '')), ['b', 'a']);
});

test('reversal turns a grab around', () => {
  const a = fighter('a', 'enemy', { stats: sure, grows: false });
  const b = fighter('b', 'party', { stats: stats({ luck: 0 }), moves: [{ name: 'reversal', level: 1 }] });
  const core = setup([b, a]);
  use(core, b, b, 'reversal');
  use(core, a, b, 'grab');
  assert.ok(!core.isBound(b));
  assert.ok(core.isBound(a));
});

test('a dodge stance fires only on a dodge', () => {
  const a = fighter('a', 'enemy', { stats: sure, grows: false });
  const b = fighter('b', 'party', { stats: stats({ luck: 0 }), moves: [{ name: 'slip_sweep', level: 1 }] });
  const core = setup([b, a], 5);
  use(core, b, b, 'slip_sweep');
  b.effects.push({ kind: 'buff', stat: 'dodgeChance', mult: 1, add: 0.5, remaining: 9, move: null, paysOnDodge: false });
  for (let i = 0; i < 20 && counters(core.events).length === 0; i++) use(core, a, b, 'jab');
  assert.equal(counters(core.events).length, 1);
  assert.ok(core.events.some((e) => e.type === 'miss' && e.actor === 'a'));
});

function run(inst: BattleInstance, ms: number): BattleEvent[] {
  const out: BattleEvent[] = [];
  for (let t = 0; t < ms; t += 100) out.push(...inst.tick(100));
  return out;
}

test('a cooldown blocks the move until it runs out', () => {
  const p = fighter('p', 'party', { stats: sure, controller: 'ai', moves: [{ name: 'cross_counter', level: 1 }] });
  const e = fighter('e', 'enemy', { stats: stats({ end: 40 }), controller: 'ai', moves: [] });
  const progress = new Map([['p', createProgress(p.stats, [{ name: 'cross_counter', level: 1 }])]]);
  const inst = new BattleInstance(data, { entities: [p, e], progress, summonerSides: new Set(), seed: 1 });
  const times: number[] = [];
  for (let t = 100; t <= 20_000; t += 100) {
    for (const x of inst.tick(100)) if (x.type === 'use' && x.actor === 'p') times.push(t);
  }
  assert.ok(times.length >= 2);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 8_000, 'uses at least 8 seconds apart');
});

test('acting drops a waiting stance', () => {
  const p = fighter('p', 'party', { stats: sure, controller: 'ai', moves: [{ name: 'punch', level: 1 }] });
  const e = fighter('e', 'enemy', { stats: stats({ end: 40 }), controller: 'ai', moves: [] });
  const progress = new Map([['p', createProgress(p.stats, [{ name: 'punch', level: 1 }])]]);
  const inst = new BattleInstance(data, { entities: [p, e], progress, summonerSides: new Set(), seed: 1 });
  p.effects.push({ kind: 'counter', move: 'cross_counter', trigger: 'hit', tags: ['punch'], status: null, take: 1, momentum: 0, power: 10, params: {}, reply: null, remaining: 99 });
  const events = run(inst, 3_000);
  assert.ok(events.some((x) => x.type === 'use' && x.actor === 'p'));
  assert.ok(!p.effects.some((f) => f.kind === 'counter'));
});
