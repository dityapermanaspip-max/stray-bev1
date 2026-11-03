import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canGift, pairCap, rollBase, shopRefuses, talkFavor, thresholds, tickOf, tierOf } from '../../server/standing/ladder.ts';
import { createRng } from '../../server/util/rng.ts';
import { cfg } from '../fixtures/battle_data.ts';

const L = cfg.standing.ladder;

test('ladder: each step is 135% of the one before (rounded up), tiers are the running sum', () => {
  assert.deepEqual(thresholds(L, 20), [20, 47, 84, 134, 202, 294, 419, 588, 817, 1127]);
});

test('tiers: 0 below the base threshold, then one per threshold passed', () => {
  assert.deepEqual([0, 19, 20, 46, 47, 83, 84, 1126, 1127, 9999].map((f) => tierOf(L, 20, f)), [0, 0, 1, 1, 2, 2, 3, 9, 10, 10]);
  assert.equal(tierOf(L, 20, -50), 0);
});

test('a pair of the same body type stops at devoted; a mixed or unknown pair does not', () => {
  assert.equal(pairCap(L, 'male', 'male'), 9);
  assert.equal(pairCap(L, 'female', 'female'), 9);
  assert.equal(pairCap(L, 'male', 'female'), 10);
  assert.equal(pairCap(L, null, 'female'), 10);
  assert.equal(tierOf(L, 20, 99999, pairCap(L, 'male', 'male')), 9);
});

test('a talk gives charm x (1 + fame / 10); bad fame slows it but never drains it', () => {
  assert.equal(talkFavor(L, 5, 0), 5);
  assert.equal(talkFavor(L, 5, 1), 5.5);
  assert.equal(talkFavor(L, 5, 10), 10);
  assert.equal(talkFavor(L, 5, -5), 2.5);
  assert.equal(talkFavor(L, 5, -50), 0.5); // the floor, 0.1 of a plain talk
  assert.equal(talkFavor(L, 5, -500), 0.5);
});

test('four talks of charm 5 reach a mercenary of base 20', () => {
  assert.equal(tierOf(L, 20, 4 * talkFavor(L, 5, 0)), 1);
  assert.equal(tierOf(L, 20, 3 * talkFavor(L, 5, 0)), 0);
});

test('a rolled base stays inside the role spread, and unknown roles use the default', () => {
  const rng = createRng(7);
  for (let i = 0; i < 200; i++) {
    const b = rollBase(L, 'mercenary', rng);
    assert.ok(b >= 15 && b <= 25, String(b));
    const d = rollBase(L, 'no_such_role', rng);
    assert.ok(d >= 23 && d <= 38, String(d));
  }
});

test('the talk cap counts per tick', () => {
  assert.equal(tickOf(L, 0), 0);
  assert.equal(tickOf(L, 5), 5);
  assert.equal(tickOf({ ...L, talkTickHours: 4 }, 7), 1);
});

test('the gift menu opens at tier 2 and allows one gift per real day', () => {
  const now = new Date('2026-11-03T12:00:00Z');
  assert.equal(canGift(L, 1, null, now), false);
  assert.equal(canGift(L, 2, null, now), true);
  assert.equal(canGift(L, 2, new Date('2026-11-03T00:00:00Z'), now), false);
  assert.equal(canGift(L, 2, new Date('2026-11-02T11:59:00Z'), now), true);
});

test('a town that has turned against the player closes its shop', () => {
  assert.equal(shopRefuses(L, 0), false);
  assert.equal(shopRefuses(L, -4), false);
  assert.equal(shopRefuses(L, -5), true);
  assert.equal(shopRefuses(L, -30), true);
});
