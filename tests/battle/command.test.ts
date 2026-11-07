import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProgress } from '../../server/battle/factory.ts';
import { BattleInstance } from '../../server/battle/instance.ts';
import type { BattleEntity, BattleEvent } from '../../server/battle/types.ts';
import { battleData, fighter, stats } from '../fixtures/battle_data.ts';

const solid = stats({ luck: 0 });

function battle(entities: BattleEntity[]) {
  const progress = new Map(entities.filter((e) => e.grows).map((e) => [e.id, createProgress(e.stats, [...e.moveLevels].map(([name, level]) => ({ name, level })))]));
  return new BattleInstance(battleData(), { entities, progress, summonerSides: new Set(), seed: 1 });
}

function run(inst: BattleInstance, ms: number): BattleEvent[] {
  const events: BattleEvent[] = [];
  for (let t = 0; t < ms; t += 100) events.push(...inst.tick(100));
  return events;
}

test('a move sent without a target uses the remembered one', () => {
  const inst = battle([fighter('p', 'party'), fighter('a', 'enemy'), fighter('b', 'enemy', { slot: 2 })]);
  assert.equal(inst.submit('p', 'punch', 'b'), null);
  assert.equal(inst.submit('p', 'punch'), null); // no target: the lock on b
  const used = run(inst, 5_000).find((e) => e.type === 'use');
  assert.deepEqual(used?.type === 'use' && used.targets, ['b']);
});

test('a dead lock is replaced by a random valid pick, and the lock follows', () => {
  const inst = battle([fighter('p', 'party'), fighter('a', 'enemy', { slot: 1 }), fighter('b', 'enemy', { slot: 2 })]);
  inst.setTarget('p', 'a');
  inst.entities.find((e) => e.id === 'a')!.phase = 'downed';
  assert.equal(inst.submit('p', 'punch'), null);
  const events = run(inst, 1);
  assert.ok(events.some((e) => e.type === 'lock' && e.target === 'b'));
});

test('a live lock that melee cannot reach refuses the move', () => {
  const inst = battle([fighter('p', 'party'), fighter('front', 'enemy'), fighter('back', 'enemy', { slot: 5 })]);
  assert.equal(inst.setTarget('p', 'back'), null);
  assert.equal(inst.submit('p', 'punch'), 'bad_target');
});

test('idle for 3 seconds repeats the last move on the locked target', () => {
  const p = fighter('p', 'party', { stats: solid });
  const inst = battle([p, fighter('e', 'enemy', { stats: stats({ str: 1, dex: 1, luck: 0 }) })]);
  assert.equal(inst.submit('p', 'punch', 'e'), null);
  const first = run(inst, 20_000).filter((e) => e.type === 'use' && e.actor === 'p');
  assert.ok(first.length >= 2, 'the player acted again with no new command');
});

test('turn order lists everyone alive, ready first', () => {
  const inst = battle([fighter('p', 'party'), fighter('e', 'enemy')]);
  assert.deepEqual([...inst.turnOrder()].sort(), ['e', 'p']);
});
