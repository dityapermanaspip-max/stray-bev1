import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SpeciesDef } from '../../server/data/species_repo.ts';
import { createRng } from '../../server/util/rng.ts';
import { rollCreature } from '../../server/world/creature_roll.ts';
import { cfg } from '../fixtures/battle_data.ts';

const bear = (moves: string[]): SpeciesDef => ({
  name: 'bear', baseStats: { str: 1, dex: 1, int: 1, end: 1, luck: 1, charm: 1 }, mainStats: ['str', 'end'], bodyParts: [], moves,
  resist: new Map(), onExpiry: 'ignore',
});
const POOL = Array.from({ length: 20 }, (_, i) => `move_${i}`);
const sum = (moves: { level: number }[]) => moves.reduce((n, m) => n + m.level, 0);

test('outer ring: stats 2-3, main stats in the upper half, 10 move levels spread over the pool', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const c = rollCreature(cfg, bear(POOL), 4, false, createRng(seed));
    for (const v of Object.values(c.stats)) assert.ok(v >= 2 && v <= 3);
    assert.equal(c.stats.str, 3);
    assert.equal(c.stats.end, 3);
    assert.equal(sum(c.moves), 10);
    assert.ok(c.moves.every((m) => POOL.includes(m.name) && m.level >= 1));
  }
});

test('inner rings spend their whole budget and no move passes the cap', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const c = rollCreature(cfg, bear(POOL), 1, false, createRng(seed));
    for (const v of Object.values(c.stats)) assert.ok(v >= 20 && v <= 27);
    assert.equal(sum(c.moves), 80);
    assert.ok(c.moves.every((m) => m.level <= 25));
  }
  const small = rollCreature(cfg, bear(['bite', 'maul']), 1, false, createRng(3)); // 2 moves cannot hold 80
  assert.deepEqual(small.moves.map((m) => m.level), [25, 25]);
});

test('two bears of the same ring differ; the same seed gives the same bear', () => {
  const a = rollCreature(cfg, bear(POOL), 2, false, createRng(1));
  const b = rollCreature(cfg, bear(POOL), 2, false, createRng(2));
  assert.notDeepEqual(a, b);
  assert.deepEqual(a, rollCreature(cfg, bear(POOL), 2, false, createRng(1)));
});

test('corrupted: stats x 1.2 and 10 more move levels per ring from the outside', () => {
  const native = rollCreature(cfg, bear(POOL), 3, false, createRng(9));
  const corrupted = rollCreature(cfg, bear(POOL), 3, true, createRng(9));
  for (const [k, v] of Object.entries(native.stats)) assert.equal(corrupted.stats[k as keyof typeof native.stats], Math.round(v * 1.2));
  assert.equal(sum(corrupted.moves), 30 + 20);
  assert.equal(sum(rollCreature(cfg, bear(POOL), 4, true, createRng(9)).moves), 10 + 10);
});

// peck opens triple_peck at 7; flurry needs triple_peck 10; combo needs both peck 5 and triple_peck 5.
const rule = (move: string, parent: string, level: number, kind = 'mastery') => ({ move, group: 'a', kind, params: { move: parent, level } });
const FOWL = ['peck', 'triple_peck', 'peck_flurry', 'combo_move'];
const fowl = (): SpeciesDef => ({
  ...bear(FOWL), unlocks: [rule('triple_peck', 'peck', 7), rule('peck_flurry', 'triple_peck', 10),
    rule('combo_move', 'peck', 5, 'combo'), rule('combo_move', 'triple_peck', 5, 'combo')],
});

test('a locked move is only rolled once its parent has reached the unlock level', () => {
  for (let seed = 1; seed <= 200; seed++) {
    for (const ring of [4, 3, 2, 1]) {
      const c = rollCreature(cfg, fowl(), ring, false, createRng(seed));
      const lv = (m: string) => c.moves.find((x) => x.name === m)?.level ?? 0;
      if (lv('triple_peck') > 0) assert.ok(lv('peck') >= 7);
      if (lv('peck_flurry') > 0) assert.ok(lv('triple_peck') >= 10);
      if (lv('combo_move') > 0) assert.ok(lv('peck') >= 5 && lv('triple_peck') >= 5);
    }
  }
  const outer = rollCreature(cfg, fowl(), 4, false, createRng(5)); // 10 levels: only peck, maybe triple_peck
  assert.ok(outer.moves.every((m) => m.name === 'peck' || m.name === 'triple_peck'));
  const inner = Array.from({ length: 30 }, (_, i) => rollCreature(cfg, fowl(), 1, false, createRng(i + 1)));
  assert.ok(inner.some((c) => c.moves.some((m) => m.name === 'peck_flurry'))); // 80 levels reach tier 3
});

test('a creature fights with its best 8 moves, like a player loadout', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const c = rollCreature(cfg, bear(POOL), 1, false, createRng(seed)); // 80 levels over 20 moves: more than 8 known
    const on = c.moves.filter((m) => m.equipped);
    const off = c.moves.filter((m) => !m.equipped);
    assert.equal(on.length, Math.min(cfg.loadoutSlots, c.moves.length));
    if (off.length > 0) assert.ok(Math.min(...on.map((m) => m.level)) >= Math.max(...off.map((m) => m.level)));
  }
  const tie = rollCreature(cfg, fowl(), 1, false, createRng(4)); // on a tie the deeper move goes first
  for (let i = 1; i < tie.moves.length; i++) assert.ok(tie.moves[i - 1].level >= tie.moves[i].level);
});

test('corrupted-only moves are rolled only by corrupted creatures', () => {
  const def = { ...bear(['bite', 'maul']), corruptedMoves: ['rot_bite'] };
  let seen = 0;
  for (let seed = 1; seed <= 40; seed++) {
    assert.ok(!rollCreature(cfg, def, 2, false, createRng(seed)).moves.some((m) => m.name === 'rot_bite'));
    if (rollCreature(cfg, def, 2, true, createRng(seed)).moves.some((m) => m.name === 'rot_bite')) seen++;
  }
  assert.ok(seen > 30);
});
