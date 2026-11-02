import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bossStats, carriedWeakening, hasFullSet, totalWeakening, weakenedProgress } from '../../server/boss/boss_rules.ts';
import { isBossHex } from '../../server/boss/boss_entry.ts';
import { createProgress } from '../../server/battle/factory.ts';
import { cfg, stats } from '../fixtures/battle_data.ts';

const TYPES = ['str', 'dex', 'int', 'end', 'luck', 'charm'];

test('carried keys weaken: per_key for the first of a type, halved for each duplicate', () => {
  const one = new Map(TYPES.map((t) => [t, 1]));
  assert.ok(Math.abs(carriedWeakening(cfg.boss, one) - 0.3) < 1e-9);
  assert.ok(Math.abs(carriedWeakening(cfg.boss, new Map([['str', 3]])) - (0.05 + 0.025 + 0.0125)) < 1e-9);
});

test('total weakening adds the shared sets and never passes the cap', () => {
  assert.equal(totalWeakening(cfg.boss, 0.3, 0.1), 0.4);
  assert.equal(totalWeakening(cfg.boss, 0.5, 0.5), 0.6);
});

test('the chamber needs a key of every type', () => {
  assert.equal(hasFullSet(TYPES, new Map(TYPES.map((t) => [t, 1]))), true);
  assert.equal(hasFullSet(TYPES, new Map(TYPES.slice(1).map((t) => [t, 2]))), false);
});

test('boss stats split boss_total evenly; weakening lowers every stat for the fight only', () => {
  const s = bossStats(250);
  assert.equal(Object.values(s).reduce((a, b) => a + b, 0), 250);
  const p = createProgress(stats({ str: 40, dex: 40 }), [{ name: 'punch', level: 3 }]);
  const w = weakenedProgress(p, 0.5);
  assert.equal(w.stats.str.base, 20);
  assert.equal(p.stats.str.base, 40); // the saved boss is untouched
  assert.equal(w.moves.get('punch')?.level, 3);
});

test('the boss hex is the centre', () => {
  const links = { hexes: new Map([['c', { id: 'c', q: 0, r: 0 }], ['x', { id: 'x', q: 1, r: 0 }]]), borders: [], towns: new Map() };
  assert.equal(isBossHex(links, 'c'), true);
  assert.equal(isBossHex(links, 'x'), false);
  assert.equal(isBossHex(links, 'corridor'), false);
});
