import assert from 'node:assert/strict';
import { test } from 'node:test';
import { conversionRate, findRingProblems, startCounts } from '../../server/config/world_config.ts';
import { cfg } from '../fixtures/battle_data.ts';

const rings = cfg.rings;

test('conversion rises by per_ring for each ring closer to the centre', () => {
  assert.deepEqual([4, 3, 2, 1].map((ring) => Number(conversionRate(rings, 0.01, ring).toFixed(3))), [0.01, 0.018, 0.026, 0.034]);
});

test('a wild hex starts with natives and corrupted rolled in their ranges', () => {
  assert.deepEqual(startCounts(rings, 1000, () => 0), { natives: 100, corrupted: 300 });
  assert.deepEqual(startCounts(rings, 1000, () => 0.5), { natives: 450, corrupted: 400 });
});

test('a species must fit the band of every ring it lives in', () => {
  assert.deepEqual(findRingProblems(rings, [{ name: 'cat', total: 17, ringMin: 4, ringMax: 4 }]), []);
  assert.deepEqual(findRingProblems(rings, [{ name: 'cat', total: 17, ringMin: 3, ringMax: 4 }]), ['species cat: total 17 outside ring 3 (30 +- 5)']);
  assert.equal(findRingProblems(rings, [{ name: 'x', total: 30, ringMin: 0, ringMax: 3 }]).length, 3); // bad range, too weak for rings 2 and 1
});
