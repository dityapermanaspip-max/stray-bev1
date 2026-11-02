import assert from 'node:assert/strict';
import { test } from 'node:test';
import { overflowing, planInvasions, type InvasionHex } from '../../server/vice/invasion.ts';
import type { PopRow } from '../../server/world/population.ts';

const cfg = { intervalHours: 10, threshold: 1.5, share: 0.7 };
const hex = (id: string, q: number, r: number, ring = 2, town = false): InvasionHex => ({ id, q, r, ring, town });
const row = (species: string, natives: number, corrupted: number, max: number): PopRow => ({ species, natives, corrupted, safe: 0, max });

test('a hex overflows at threshold x max pop', () => {
  assert.equal(overflowing(cfg, [row('cat', 50, 100, 100)]), true);
  assert.equal(overflowing(cfg, [row('cat', 50, 99, 100)]), false);
  assert.equal(overflowing(cfg, []), false);
});

test('the vice leads share of the corrupted to the nearest free wild hex; a new vice is due behind it', () => {
  const hexes = [hex('src', 0, 0), hex('near', 1, 0), hex('town', 0, 1, 2, true), hex('boss', -1, 0, 0), hex('far', 3, 0)];
  const pop = new Map<string, PopRow[]>([['src', [row('cat', 50, 100, 100), row('rat', 0, 9, 0)]], ['near', [row('cat', 10, 5, 100)]]]);
  const vices = new Map([['src', 'v1']]);
  const done = planInvasions(cfg, hexes, pop, vices, () => 0);
  assert.equal(done.length, 1);
  assert.equal(done[0].to, 'near'); // the town and the boss hex are as close, but never targets
  assert.deepEqual([...done[0].invaders], [['cat', 70], ['rat', 6]]);
  assert.equal(pop.get('src')![0].corrupted, 30);
  assert.equal(pop.get('near')![0].corrupted, 75);
  assert.deepEqual(pop.get('near')![1], row('rat', 0, 6, 0)); // a species new there gets a row
  assert.equal(vices.get('near'), 'v1');
  assert.equal(vices.get('src'), ''); // taken by the vice born there
});

test('no free hex: the vice waits; quiet hexes never invade', () => {
  const hexes = [hex('a', 0, 0), hex('b', 1, 0)];
  const pop = new Map([['a', [row('cat', 50, 100, 100)]], ['b', [row('cat', 1, 1, 100)]]]);
  assert.equal(planInvasions(cfg, hexes, pop, new Map([['a', 'v1'], ['b', 'v2']]), () => 0).length, 0);
  assert.equal(pop.get('a')![0].corrupted, 100);
});

test('ties between free hexes go by chance', () => {
  const hexes = [hex('src', 0, 0), hex('east', 1, 0), hex('west', -1, 0)];
  const pick = (roll: number) => planInvasions(cfg, hexes, new Map([['src', [row('cat', 50, 100, 100)]]]), new Map([['src', 'v']]), () => roll)[0].to;
  assert.notEqual(pick(0), pick(0.99));
});
