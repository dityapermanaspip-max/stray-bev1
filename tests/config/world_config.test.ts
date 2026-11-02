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

test('a species born corrupted starts with the whole head count corrupted and no natives', () => {
  assert.deepEqual(startCounts(rings, 1000, () => 0.5, true), { natives: 0, corrupted: 850 });
});

test('a species must live inside the round rings', () => {
  assert.deepEqual(findRingProblems(rings, [{ name: 'cat', ringMin: 1, ringMax: 4 }]), []);
  assert.deepEqual(findRingProblems(rings, [{ name: 'x', ringMin: 0, ringMax: 3 }]), ['species x: rings 0-3 outside 1-4']);
});
