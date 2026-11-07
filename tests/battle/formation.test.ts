import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BattleCore } from '../../server/battle/core.ts';
import { HANDLERS } from '../../server/battle/effects/registry.ts';
import { placeFoes, placeParty, rowOf, slotBehind } from '../../server/battle/formation.ts';
import { validTargets } from '../../server/battle/rules.ts';
import type { BattleEntity } from '../../server/battle/types.ts';
import { createRng } from '../../server/util/rng.ts';
import { battleData, cfg, fighter, move, MOVES, stats } from '../fixtures/battle_data.ts';

const f = cfg.formation;
const sure = stats({ dex: 30, int: 30, luck: 0 });
const solid = stats({ luck: 0 });
const punch = MOVES.get('punch')!;
const shot = move({ name: 'shot', rowRule: 'any', effects: [{ handler: 'damage', power: 5, durationTurns: null, chance: 1, params: {} }] });

test('slots 1-4 are the front row, 5-7 the back; the front spreads over the back', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((s) => rowOf(f, s)), ['front', 'front', 'front', 'front', 'back', 'back', 'back']);
  assert.deepEqual([1, 2, 3, 4, 5].map((s) => slotBehind(f, s)), [5, 6, 6, 7, null]);
});

test('foes fill the front first, at most 7', () => {
  assert.deepEqual(placeFoes(f, 3), [1, 2, 3]);
  assert.deepEqual(placeFoes(f, 6), [1, 2, 3, 4, 5, 6]);
  assert.equal(placeFoes(f, 9).length, 7);
});

test('companions fill the party around the player, front first, up to party_max', () => {
  assert.deepEqual(placeParty(f, [2], 3), [1, 3, 4]); // the player holds 2, next come 1, 3, 4
  assert.deepEqual(placeParty(f, [7], 3), [1, 2, 3]); // a back-row player does not push a packed front
  assert.deepEqual(placeParty(f, [1, 3], 2), [2, 4]); // seats stay hers, the same slot never twice
  assert.deepEqual(placeParty(f, [1], 3).length, 3);
});

test('a party never exceeds party_max members', () => {
  assert.deepEqual(placeParty(f, [1, 2, 3], 3), [4]); // the player and two companions: one seat left
  assert.deepEqual(placeParty(f, [1, 2, 3, 4], 1), []); // full
});

test('no melee from behind a living front row; ranged works from anywhere and reaches the back', () => {
  const me = fighter('me', 'party', { slot: 5 });
  const ally = fighter('ally', 'party', { slot: 1 });
  const front = fighter('front', 'enemy', { slot: 1 });
  const back = fighter('back', 'enemy', { slot: 6 });
  const all = [me, ally, front, back];
  assert.deepEqual(validTargets(all, me, punch), []);
  assert.deepEqual(validTargets(all, me, shot).map((e) => e.id), ['front', 'back']);
  const enemy = fighter('e', 'enemy', { slot: 5 }); // the same rule for the other side
  assert.deepEqual(validTargets([enemy, fighter('e2', 'enemy', { slot: 2 }), fighter('p', 'party', { slot: 1 })], enemy, punch), []);
});

test('with its front row empty, the back row fights at the front without moving', () => {
  const me = fighter('me', 'party', { slot: 5 }); // a lone fighter knocked back
  const front = fighter('front', 'enemy', { slot: 1 });
  assert.deepEqual(validTargets([me, front], me, punch).map((e) => e.id), ['front']);
  const fallen = fighter('ally', 'party', { slot: 1 });
  fallen.phase = 'downed';
  assert.deepEqual(validTargets([me, fallen, front], me, punch).map((e) => e.id), ['front']);
  assert.equal(me.slot, 5);
});

function shove(target: BattleEntity, others: BattleEntity[]) {
  const actor = fighter('me', 'party', { stats: sure, slot: 1 });
  const core = new BattleCore(battleData(), [actor, target, ...others], createRng(1), new Map(), new Set());
  HANDLERS.knockback({ core, actor, move: punch, level: 1, rates: { damage: 0, recovery: 0, cost: 0 }, channelTurns: null }, target,
    { handler: 'knockback', power: 10, durationTurns: null, chance: 1, params: { accuracy: 1 } });
}

test('knockback pushes a front fighter into the empty back slot behind it', () => {
  const target = fighter('t', 'enemy', { stats: solid, slot: 2 });
  shove(target, []);
  assert.equal(target.slot, 6);
  assert.equal(target.row, 'back');
});

test('knockback into a taken slot: nobody moves, both take the same collision damage', () => {
  const target = fighter('t', 'enemy', { stats: solid, slot: 4 });
  const behind = fighter('b', 'enemy', { stats: solid, slot: 7 });
  const full = behind.hp;
  shove(target, [behind]);
  assert.equal(target.slot, 4);
  assert.equal(behind.slot, 7);
  const lost = full - behind.hp;
  assert.ok(lost >= cfg.combat.minDamage);
  assert.ok(full - target.hp > lost); // the hit plus the same collision damage
});
