import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freeSeat, paidUntil, unlocked, wageMs } from '../../server/recruit/companion_rules.ts';
import { cfg } from '../fixtures/battle_data.ts';

const L = cfg.standing.ladder;

test('tiers open what the config says: hire at 1, gift at 2, party at 3, command at 5; unknown keys stay closed', () => {
  assert.deepEqual([0, 1, 2].map((t) => unlocked(L, 'hire', t)), [false, true, true]);
  assert.deepEqual([1, 2].map((t) => unlocked(L, 'gift', t)), [false, true]);
  assert.deepEqual([2, 3].map((t) => unlocked(L, 'party', t)), [false, true]);
  assert.deepEqual([4, 5].map((t) => unlocked(L, 'command', t)), [false, true]);
  assert.equal(unlocked(L, 'no_such_thing', 10), false);
});

test('the party seat: the lowest free one of three, none when full', () => {
  assert.equal(freeSeat([], 3), 1);
  assert.equal(freeSeat([1, 3], 3), 2);
  assert.equal(freeSeat([1, 2, 3], 3), null);
});

test('a wage payment covers hire_days world days; paying early adds to what is left', () => {
  const hour = 3_600_000;
  assert.equal(wageMs(L, hour), 24 * hour);
  assert.equal(paidUntil(L, hour, 1000, null), 1000 + 24 * hour);
  assert.equal(paidUntil(L, hour, 1000, 50_000), 50_000 + 24 * hour);
  assert.equal(paidUntil(L, hour, 90_000_000, 50_000), 90_000_000 + 24 * hour);
});
