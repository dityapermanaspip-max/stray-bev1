import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baseDamage, defenseReduction, finalDamage, hitChance, levelMult, statMult } from '../../server/battle/damage.ts';
import { cfg } from '../fixtures/battle_data.ts';

const c = cfg.combat;
const punch = (str: number, level: number) =>
  baseDamage({
    power: 10,
    weaponPower: 0,
    ammoPower: 0,
    typeBonus: 1,
    levelMult: levelMult(0.03, level),
    statMult: statMult(c, str),
    resistType: 1,
    resistElement: 1,
    defenseReduction: 0,
  });

test('str 10 punch at level 1 deals 15 (MOVES.md example)', () => {
  assert.equal(finalDamage(c, punch(10, 1), false, false), 15);
});

test('level 20 punch at str 5 roughly equals level 1 punch at str 10', () => {
  assert.ok(Math.abs(punch(5, 20) - 15.7) < 1e-9); // 10 * 1.57 * 1.0
  assert.equal(finalDamage(c, punch(5, 20), false, false), 16);
});

test('crit multiplies, immunity zeroes, landed hits deal at least the minimum', () => {
  assert.equal(finalDamage(c, 10, true, false), 15);
  assert.equal(finalDamage(c, 10, false, true), 0);
  assert.equal(finalDamage(c, 0.2, false, false), 1);
});

test('defense is a percent that never reaches 100%', () => {
  assert.equal(defenseReduction(c, 20), 0.5);
  assert.ok(defenseReduction(c, 10000) < 1);
});

test('hit chance = min(1, acc * (0.5 + accuracy/20)) * (1 - dodge)', () => {
  assert.equal(hitChance(c, 1, 5, 0), 0.75);
  assert.ok(Math.abs(hitChance(c, 0.8, 5, 0) - 0.6) < 1e-12);
  assert.equal(hitChance(c, 1, 100, 0), 1);
  assert.equal(hitChance(c, 1, 100, 0.9), 0.5); // dodge capped at 0.5
});
