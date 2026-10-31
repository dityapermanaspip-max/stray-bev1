import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProgress } from '../../server/battle/factory.ts';
import { BattleInstance } from '../../server/battle/instance.ts';
import { findUnlocks, learnUnlocks, type UnlockRule } from '../../server/growth/unlocks.ts';
import { battleData, fighter, stats } from '../fixtures/battle_data.ts';

const rule = (move: string, group: string, kind: string, params: Record<string, unknown>): UnlockRule => ({ move, group, kind, params });

const RULES = [
  rule('heavy_strike', 'a', 'mastery', { move: 'punch', level: 4 }),
  rule('rally', 'a', 'combo', { move: 'punch', level: 4 }),
  rule('rally', 'a', 'combo', { move: 'kick', level: 3 }),
  rule('bandage', 'a', 'trainer', { trainer_tag: 'healer' }),
  rule('bandage', 'b', 'scroll', {}),
];

test('mastery unlocks once the move reaches the level', () => {
  const p = createProgress(stats(), [{ name: 'punch', level: 3 }, { name: 'kick', level: 1 }]);
  assert.deepEqual(findUnlocks(RULES, p), []);
  p.moves.get('punch')!.level = 4;
  assert.deepEqual(findUnlocks(RULES, p), [{ move: 'heavy_strike', kind: 'mastery' }]);
});

test('a combo needs every condition in its group', () => {
  const p = createProgress(stats(), [{ name: 'punch', level: 4 }, { name: 'kick', level: 2 }]);
  assert.ok(!findUnlocks(RULES, p).some((l) => l.move === 'rally'));
  p.moves.get('kick')!.level = 3;
  assert.ok(findUnlocks(RULES, p).some((l) => l.move === 'rally'));
});

test('different groups are alternatives: trainer or scroll', () => {
  const p = createProgress(stats(), [{ name: 'punch', level: 1 }]);
  assert.deepEqual(findUnlocks(RULES, p, { trainerTags: new Set(['healer']) }), [{ move: 'bandage', kind: 'trainer' }]);
  const reader = createProgress(stats(), [{ name: 'punch', level: 1 }], ['bandage']);
  assert.deepEqual(findUnlocks(RULES, reader), [{ move: 'bandage', kind: 'scroll' }]);
});

test('learning registers the move once at level 1', () => {
  const p = createProgress(stats(), [{ name: 'punch', level: 4 }]);
  assert.equal(learnUnlocks(RULES, p).length, 1);
  assert.deepEqual(p.moves.get('heavy_strike'), { level: 1, exp: 0 });
  assert.deepEqual(learnUnlocks(RULES, p), []);
});

test('a level-up in battle learns the move but does not equip it', () => {
  const data = { ...battleData(), unlocks: [rule('bandage', 'a', 'mastery', { move: 'punch', level: 2 })] };
  const p = fighter('p', 'party', { stats: stats({ str: 10, dex: 30, int: 30, luck: 0 }), controller: 'ai' });
  const e = fighter('e', 'enemy', { stats: stats({ str: 1, end: 40, luck: 0 }), controller: 'ai', moves: [] });
  const progress = createProgress(p.stats, [{ name: 'punch', level: 1 }]);
  progress.moves.get('punch')!.exp = 30; // one hit away from level 2
  const inst = new BattleInstance(data, { entities: [p, e], progress: new Map([['p', progress]]), summonerSides: new Set(), seed: 1 });
  const events = Array.from({ length: 30 }, () => inst.tick(100)).flat();
  assert.ok(events.some((x) => x.type === 'learned' && x.move === 'bandage'));
  assert.ok(progress.moves.has('bandage'));
  assert.deepEqual(p.moves, ['punch']);
});
