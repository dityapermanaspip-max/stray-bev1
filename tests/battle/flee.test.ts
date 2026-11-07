import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fleeChance, fleeRoll, type FleeConfig } from '../../server/battle/flee.ts';

const cfg: FleeConfig = { base: 0.5, speed_slope: 0.5, luck_slope: 0.15, floor: 0.05, cap: 0.95 };
const r = (speed: number, luck: number) => ({ speed, luck });

test('equal speed and luck give the base chance', () => {
  assert.equal(fleeChance(cfg, [r(10, 5)], [r(10, 5)]), 0.5);
});

test('the slowest standing party member and the fastest enemy decide the speed part', () => {
  const quick = fleeChance(cfg, [r(10, 0), r(20, 0)], [r(10, 0)]);
  const slow = fleeChance(cfg, [r(5, 0), r(20, 0)], [r(10, 0), r(8, 0)]);
  assert.ok(slow < quick);
  assert.equal(fleeChance(cfg, [r(5, 0), r(20, 0)], [r(10, 0)]), fleeChance(cfg, [r(5, 0)], [r(10, 0)])); // 20 does not help
  assert.equal(fleeChance(cfg, [r(10, 0)], [r(10, 0), r(4, 0)]), fleeChance(cfg, [r(10, 0)], [r(10, 0)])); // 4 does not hurt
});

test('the luckiest of each side moves the chance, and it stays between floor and cap', () => {
  assert.ok(fleeChance(cfg, [r(10, 20)], [r(10, 2)]) > fleeChance(cfg, [r(10, 2)], [r(10, 20)]));
  assert.equal(fleeChance(cfg, [r(1, 0)], [r(1000, 0)]), cfg.floor);
  assert.equal(fleeChance(cfg, [r(1000, 0)], [r(1, 0)]), cfg.cap);
});

test('the roll follows the chance', () => {
  assert.equal(fleeRoll(cfg, [r(10, 0)], [r(10, 0)], () => 0.49), true);
  assert.equal(fleeRoll(cfg, [r(10, 0)], [r(10, 0)], () => 0.5), false);
});
