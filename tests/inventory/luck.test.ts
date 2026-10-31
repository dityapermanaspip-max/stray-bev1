import assert from 'node:assert/strict';
import { test } from 'node:test';
import { badChance, goodChance, rollPermille } from '../../server/util/luck.ts';

const luck = { perPoint: 1, badFloor: 0 };

test('luck adds flat per-mille: 2 becomes 7 and 500 becomes 505 at luck 5', () => {
  assert.equal(goodChance(luck, 2, 5), 7);
  assert.equal(goodChance(luck, 500, 5), 505);
  assert.equal(goodChance(luck, 998, 5), 1000);
});

test('bad chances fall with luck down to the floor share of their base', () => {
  assert.equal(badChance(luck, 30, 5), 25);
  assert.equal(badChance(luck, 30, 50), 0);
  assert.equal(badChance({ perPoint: 1, badFloor: 0.25 }, 40, 50), 10);
  assert.equal(badChance(luck, 80, 5), 75); // a dense field stays dangerous
});

test('rolls are whole numbers out of 1000', () => {
  assert.equal(rollPermille(() => 0.006, 7), true);
  assert.equal(rollPermille(() => 0.007, 7), false);
  assert.equal(rollPermille(() => 0.9999, 1000), true);
  assert.equal(rollPermille(() => 0, 0), false);
});
