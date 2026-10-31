import assert from 'node:assert/strict';
import { test } from 'node:test';
import { birthHex, corruptionRatio, viceStats, type BirthHex } from '../../server/vice/rebirth.ts';
import { cfg } from '../fixtures/battle_data.ts';

const hex = (id: string, ring: number, extra: Partial<BirthHex> = {}): BirthHex => ({ id, q: 0, r: 0, ring, town: false, hasVice: false, ...extra });
const rows = (natives: number, corrupted: number) => [{ species: 'x', natives, corrupted, safe: 0, max: 0 }];

test('corruption ratio is corrupted over all creatures', () => {
  assert.equal(corruptionRatio(rows(300, 100)), 0.25);
  assert.equal(corruptionRatio([]), 0);
});

test('a new vice is born in the most corrupted wild hex without a vice; never a town or the boss hex', () => {
  const hexes = [hex('a', 3), hex('b', 2), hex('town', 4, { town: true }), hex('taken', 1, { hasVice: true }), hex('boss', 0)];
  const pop = new Map([['a', rows(100, 300)], ['b', rows(300, 100)], ['town', rows(0, 999)], ['taken', rows(0, 999)], ['boss', rows(0, 999)]]);
  assert.equal(birthHex(hexes, pop, () => 0)?.id, 'a');
});

test('ties go to the inner ring, then by chance; no free hex means no birth', () => {
  const pop = new Map([['a', rows(1, 1)], ['b', rows(1, 1)], ['c', rows(1, 1)]]);
  assert.equal(birthHex([hex('a', 3), hex('b', 1), hex('c', 1)], pop, () => 0.99)?.id, 'c');
  assert.equal(birthHex([hex('a', 3, { hasVice: true })], pop, () => 0), null);
});

test("a vice has its ring's creature total plus the vice bonus, weighted to its type's stat", () => {
  const s = viceStats(cfg.vice, cfg.rings, 'str', 1); // 100 + 30 = 130 over weight 7: 18 each, str the rest
  assert.deepEqual(s, { str: 40, dex: 18, int: 18, end: 18, luck: 18, charm: 18 });
  assert.equal(Object.values(viceStats(cfg.vice, cfg.rings, 'luck', 4)).reduce((n, v) => n + v, 0), 45);
});
