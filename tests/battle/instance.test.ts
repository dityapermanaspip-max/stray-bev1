import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProgress } from '../../server/battle/factory.ts';
import { BattleInstance } from '../../server/battle/instance.ts';
import type { BattleEntity, BattleEvent } from '../../server/battle/types.ts';
import { battleData, fighter, stats } from '../fixtures/battle_data.ts';

// Sure hits: high dex/int accuracy, zero luck = no dodge and no crit.
const sure = stats({ dex: 30, int: 30, luck: 0 });
const solid = stats({ luck: 0 });

function battle(entities: BattleEntity[], seed = 1) {
  const progress = new Map(
    entities.filter((e) => e.grows).map((e) => [e.id, createProgress(e.stats, [...e.moveLevels].map(([name, level]) => ({ name, level })))]),
  );
  return { inst: new BattleInstance(battleData(), { entities, progress, summonerSides: new Set(), seed }), progress };
}

function run(inst: BattleInstance, ms: number): BattleEvent[] {
  const events: BattleEvent[] = [];
  for (let t = 0; t < ms; t += 100) events.push(...inst.tick(100));
  return events;
}

test('melee cannot reach the back row while the front row stands', () => {
  const back = fighter('back', 'enemy', { row: 'back' });
  const { inst } = battle([fighter('p', 'party'), fighter('front', 'enemy'), back]);
  assert.equal(inst.submit('p', 'punch', 'back'), 'bad_target');
  assert.equal(inst.submit('p', 'punch', 'front'), null);
});

test('the faster entity acts first and the battle ends with a winner', () => {
  const p = fighter('p', 'party', { stats: stats({ str: 10, dex: 30, int: 30, luck: 0 }), controller: 'ai' });
  const e = fighter('e', 'enemy', { stats: stats({ str: 2, dex: 2, luck: 0 }), controller: 'ai' });
  const { inst } = battle([p, e]);
  const events = run(inst, 60_000);
  const firstUse = events.find((x) => x.type === 'use');
  assert.equal(firstUse?.type === 'use' && firstUse.actor, 'p');
  assert.equal(inst.winner, 'party');
  assert.ok(events.some((x) => x.type === 'end'));
});

test('damage interrupts a channel on another ally; delivered ticks stay', () => {
  const healer = fighter('healer', 'party', { stats: solid, moves: [{ name: 'bandage', level: 1 }] });
  const ally = fighter('ally', 'party', { row: 'back', stats: solid });
  ally.hp = 10;
  const enemy = fighter('enemy', 'enemy', { stats: sure });
  const { inst } = battle([healer, ally, enemy]);

  assert.equal(inst.submit('healer', 'bandage', 'ally'), null);
  const before = run(inst, 3_100); // gauge fills (2s), channel starts, one tick delivered
  assert.ok(before.some((x) => x.type === 'status' && x.status === 'channel' && x.phase === 'start'));
  const healedEarly = ally.hp;
  assert.ok(healedEarly > 10);

  assert.equal(inst.submit('enemy', 'punch', 'healer'), null);
  const after = run(inst, 4_000);
  assert.ok(after.some((x) => x.type === 'interrupt' && x.entity === 'healer'));
  assert.ok(ally.hp >= healedEarly, 'delivered healing is kept');
  assert.ok(!healer.effects.some((f) => f.kind === 'channel'));
});

test('self heal is a HoT that keeps ticking when hit', () => {
  const p = fighter('p', 'party', { stats: solid, moves: [{ name: 'bandage', level: 1 }] });
  p.hp = 20;
  const enemy = fighter('enemy', 'enemy', { stats: sure });
  const { inst } = battle([p, enemy]);
  inst.submit('p', 'bandage', 'p');
  inst.submit('enemy', 'punch', 'p');
  const events = run(inst, 6_000);
  assert.ok(!events.some((x) => x.type === 'interrupt'));
  assert.ok(events.filter((x) => x.type === 'heal').length >= 2);
});

test('heal moves earn exp only once healing is delivered', () => {
  const healer = fighter('healer', 'party', { stats: solid, moves: [{ name: 'bandage', level: 1 }] });
  const ally = fighter('ally', 'party', { stats: solid });
  const { inst, progress } = battle([healer, ally, fighter('enemy', 'enemy', { stats: solid })]);
  inst.submit('healer', 'bandage', 'ally'); // ally is unhurt: nothing to deliver
  run(inst, 6_000);
  assert.equal(progress.get('healer')!.moves.get('bandage')!.exp, 0);
});

test('events never carry hidden or raw body numbers', () => {
  const p = fighter('p', 'party', { controller: 'ai' });
  const e = fighter('e', 'enemy', { controller: 'ai' });
  const { inst } = battle([p, e], 9);
  const events = run(inst, 120_000);
  const forbidden = ['hp', 'stamina', 'mana', 'exp', 'level', 'stats', 'favor', 'fame', 'affinity'];
  for (const event of events) {
    for (const key of Object.keys(event)) assert.ok(!forbidden.includes(key), `${event.type} has ${key}`);
  }
});

test('same seed replays the same battle', () => {
  const make = () =>
    battle([fighter('p', 'party', { controller: 'ai' }), fighter('e', 'enemy', { controller: 'ai' })], 42).inst;
  assert.deepEqual(run(make(), 30_000), run(make(), 30_000));
});
