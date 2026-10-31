import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enemyExpMult } from '../../server/battle/exp.ts';
import { createProgress } from '../../server/battle/factory.ts';
import { addMoveExp } from '../../server/growth/level_up.ts';
import { moveExpRequired, moveLevelWordTier, statExpRequired } from '../../server/stats/curves.ts';
import { calcDerived } from '../../server/stats/derived.ts';
import { cfg, stats } from '../fixtures/battle_data.ts';

test('derived stats at all 5s match stats.py', () => {
  const d = calcDerived(stats(), cfg.derived);
  assert.equal(d.maxHp, 70); // sqrt(25)*10 + 4*5
  assert.equal(d.maxStamina, 90); // sqrt(25)*4 + 14*5
  assert.equal(d.maxMana, 75); // sqrt(25)*4 + 9*5 + 2*5
  assert.equal(d.maxInventoryWeight, 90); // 5*12 + 30
  assert.equal(d.speed, 5);
  assert.equal(d.accuracy, 5);
  assert.ok(Math.abs(d.dodgeChance - 0.005) < 1e-12); // sqrt(5*5) * 0.001
});

test('speed and accuracy are capped by twice the weaker stat', () => {
  const d = calcDerived(stats({ str: 1, dex: 100 }), cfg.derived);
  assert.equal(d.speed, 2); // min(sqrt(100), 2*1)
});

test('move curve {20,9,2}: level 2 at 31, level 10 at 1155, level 20 at 7030 total', () => {
  assert.equal(moveExpRequired(cfg, 1), 31);
  const total = (to: number) => Array.from({ length: to - 1 }, (_, i) => moveExpRequired(cfg, i + 1)).reduce((a, b) => a + b, 0);
  assert.equal(total(10), 1155);
  assert.equal(total(20), 7030);
  assert.equal(statExpRequired(cfg, 5), 132); // 47 + 17*5
  assert.equal(moveLevelWordTier(cfg, 1), 1);
  assert.equal(moveLevelWordTier(cfg, 5), 2);
  assert.equal(moveLevelWordTier(cfg, 20), 4);
});

test('move level-up pays a flat stat exp times the share', () => {
  const p = createProgress(stats(), [{ name: 'punch', level: 1 }]);
  const events = addMoveExp(p, 'punch', 31, { statExp: { str: 3, dex: 1 }, expScaling: 1 }, cfg);
  assert.equal(p.moves.get('punch')!.level, 2);
  assert.equal(p.moves.get('punch')!.exp, 0);
  assert.equal(p.stats.str.exp, 45); // 15 * 3
  assert.equal(p.stats.dex.exp, 15); // 15 * 1
  assert.deepEqual(events, [{ kind: 'move_level_up', move: 'punch', level: 2 }]);
});

test('one move mastered alone raises its main stat by about 5', () => {
  const p = createProgress(stats(), [{ name: 'punch', level: 1 }]);
  addMoveExp(p, 'punch', 1_000_000, { statExp: { str: 3, dex: 1 }, expScaling: 1 }, cfg);
  assert.equal(p.moves.get('punch')!.level, 20);
  assert.equal(p.stats.str.base, 10); // 19 level-ups * 45 = 855 >= 830
  assert.equal(p.stats.dex.base, 7); // 19 * 15 = 285 >= 132 + 149
});

test('stats level when exp clears the curve', () => {
  const p = createProgress(stats(), [{ name: 'punch', level: 4 }]);
  // L4 -> L5 needs 20 + 36 + 32 = 88. Flat reward 15 * share 9 = 135 >= 132.
  const events = addMoveExp(p, 'punch', 88, { statExp: { str: 9 }, expScaling: 1 }, cfg);
  assert.equal(p.stats.str.base, 6);
  assert.equal(p.stats.str.exp, 3);
  assert.ok(events.some((e) => e.kind === 'move_word' && e.tier === 2));
  assert.ok(events.some((e) => e.kind === 'stat_up' && e.stat === 'str'));
});

test('a capped move stops growing', () => {
  const p = createProgress(stats(), [{ name: 'punch', level: 20 }]);
  assert.deepEqual(addMoveExp(p, 'punch', 1000, { statExp: { str: 3 }, expScaling: 1 }, cfg), []);
  assert.equal(p.stats.str.exp, 0);
});

test('full exp against enemies with at least 40% of your stats', () => {
  const s = cfg.enemyScaling;
  assert.equal(enemyExpMult(s, 13, 30), 1); // chicken vs new player: 43%
  assert.equal(enemyExpMult(s, 6, 30), 0.5); // 20% is half of 40%
  assert.equal(enemyExpMult(s, 1, 300), 0.1); // floor
});
