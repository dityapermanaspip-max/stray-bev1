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

const T1 = { statExp: { str: 3, dex: 1 }, expScaling: 1, tier: 1, tags: [] }; // punch: tier 1, split 3:1

test('move curve {30,16,0}: level 2 at 46, level 10 at 990, level 25 at 5520 total; word tiers 1/7/13/25', () => {
  assert.equal(moveExpRequired(cfg, 1), 46);
  const total = (to: number) => Array.from({ length: to - 1 }, (_, i) => moveExpRequired(cfg, i + 1)).reduce((a, b) => a + b, 0);
  assert.equal(total(10), 990);
  assert.equal(total(25), 5520);
  assert.equal(statExpRequired(cfg, 5), 132); // 47 + 17*5
  assert.deepEqual([1, 6, 7, 13, 24, 25].map((l) => moveLevelWordTier(cfg, l)), [1, 1, 2, 3, 3, 4]);
});

test('a level-up pays 15 per point, the tier points split by the move shares', () => {
  const p = createProgress(stats(), [{ name: 'punch', level: 1 }]);
  const events = addMoveExp(p, 'punch', 46, T1, cfg);
  assert.equal(p.moves.get('punch')!.level, 2);
  assert.equal(p.moves.get('punch')!.exp, 0);
  assert.equal(p.stats.str.exp, 33.75); // 15 x 3 points x 3/4
  assert.equal(p.stats.dex.exp, 11.25); // 15 x 3 x 1/4
  assert.deepEqual(events, [{ kind: 'move_level_up', move: 'punch', level: 2 }]);
});

test('points rise every 6 levels and with the tier', () => {
  const band = createProgress(stats(), [{ name: 'punch', level: 6 }]);
  addMoveExp(band, 'punch', 126, T1, cfg); // level 7: tier 1 pays 3 + 1 = 4 points
  assert.equal(band.stats.str.exp + band.stats.dex.exp, 60);
  const high = createProgress(stats(), [{ name: 'lunge', level: 1 }]);
  addMoveExp(high, 'lunge', 46, { ...T1, tier: 3 }, cfg); // tier 3 pays 7 points
  assert.equal(high.stats.str.exp + high.stats.dex.exp, 105);
});

test('a race rule changes move exp only where it matches (human: levels 1-6)', () => {
  const human = createProgress(stats(), [{ name: 'punch', level: 1 }]);
  human.race = 'human';
  addMoveExp(human, 'punch', 40, T1, cfg); // 40 x 1.15 = 46: a level-up
  assert.equal(human.moves.get('punch')!.level, 2);
  const other = createProgress(stats(), [{ name: 'punch', level: 1 }]);
  addMoveExp(other, 'punch', 40, T1, cfg);
  assert.equal(other.moves.get('punch')!.level, 1);
  const late = createProgress(stats(), [{ name: 'punch', level: 7 }]);
  late.race = 'human';
  addMoveExp(late, 'punch', 100, T1, cfg);
  assert.equal(late.moves.get('punch')!.exp, 100); // past level 6: no bonus
});

test('one tier-1 move mastered alone raises its main stat by about 6', () => {
  const p = createProgress(stats(), [{ name: 'punch', level: 1 }]);
  addMoveExp(p, 'punch', 1_000_000, T1, cfg);
  assert.equal(p.moves.get('punch')!.level, 25);
  // 112 points x 15 = 1680: str 1260 (5 -> 11 costs 1047), dex 420 (5 -> 7 costs 281)
  assert.equal(p.stats.str.base, 11);
  assert.equal(p.stats.dex.base, 7);
});

test('stats level when exp clears the curve', () => {
  const p = createProgress(stats(), [{ name: 'punch', level: 6 }]);
  p.stats.str.exp = 80;
  // L6 -> L7 needs 30 + 96 = 126 and pays 4 points x 15 = 60, all str: 140 >= 132.
  const events = addMoveExp(p, 'punch', 126, { ...T1, statExp: { str: 9 } }, cfg);
  assert.equal(p.stats.str.base, 6);
  assert.equal(p.stats.str.exp, 8);
  assert.ok(events.some((e) => e.kind === 'move_word' && e.tier === 2));
  assert.ok(events.some((e) => e.kind === 'stat_up' && e.stat === 'str'));
});

test('a capped move stops growing', () => {
  const p = createProgress(stats(), [{ name: 'punch', level: 25 }]);
  assert.deepEqual(addMoveExp(p, 'punch', 1000, { ...T1, statExp: { str: 3 } }, cfg), []);
  assert.equal(p.stats.str.exp, 0);
});

test('full exp against enemies with at least 40% of your stats', () => {
  const s = cfg.enemyScaling;
  assert.equal(enemyExpMult(s, 13, 30), 1); // chicken vs new player: 43%
  assert.equal(enemyExpMult(s, 6, 30), 0.5); // 20% is half of 40%
  assert.equal(enemyExpMult(s, 1, 300), 0.1); // floor
});
