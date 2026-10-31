import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProgress } from '../../server/battle/factory.ts';
import { canSwap, equip, equippedMoves, firstFreeSlot, starterLoadout, unequip } from '../../server/loadout/loadout.ts';
import { cfg, move, stats } from '../fixtures/battle_data.ts';

const town = { inTown: true, inBattle: false };
const field = { inTown: false, inBattle: false };
const NAMES = ['punch', 'kick', 'guard', 'mining'];
const known = () => createProgress(stats(), NAMES.map((name) => ({ name, level: 1 })));
const moves = new Map(NAMES.map((name) => [name, move({ name, effects: [], category: name === 'mining' ? 'life' : 'attack' })]));

test('swaps happen only in towns, never in battle, unless the testing flag is on', () => {
  assert.equal(canSwap(cfg, town), null);
  assert.equal(canSwap(cfg, field), 'not_in_town');
  assert.equal(canSwap(cfg, { inTown: true, inBattle: true }), 'in_battle');
  const anywhere = { ...cfg, loadoutSwapAnywhere: true };
  assert.equal(canSwap(anywhere, field), null);
  assert.equal(canSwap(anywhere, { inTown: false, inBattle: true }), 'in_battle');
});

test('starter loadout fills the first slots in order', () => {
  const l = starterLoadout(cfg, ['punch', 'kick']);
  assert.deepEqual(equippedMoves(l), ['punch', 'kick']);
  assert.equal(firstFreeSlot(cfg, l), 3);
});

test('equip checks the place, the slot range and that the move is known', () => {
  const l = starterLoadout(cfg, ['punch', 'kick']);
  assert.equal(equip(cfg, l, known(), moves, 0, 'guard', town), 'bad_slot');
  assert.equal(equip(cfg, l, known(), moves, cfg.loadoutSlots + 1, 'guard', town), 'bad_slot');
  assert.equal(equip(cfg, l, known(), moves, 3, 'rally', town), 'unknown_move');
  assert.equal(equip(cfg, l, known(), moves, 3, 'guard', field), 'not_in_town');
  assert.equal(equip(cfg, l, known(), moves, 8, 'guard', town), null);
  assert.equal(l.get(8), 'guard');
});

test('equipping a move that sits in another slot trades the two slots', () => {
  const l = starterLoadout(cfg, ['punch', 'kick']);
  assert.equal(equip(cfg, l, known(), moves, 1, 'kick', town), null);
  assert.equal(l.get(1), 'kick');
  assert.equal(l.get(2), 'punch');
  assert.equal(l.size, 2);
});

test('unequip empties the slot', () => {
  const l = starterLoadout(cfg, ['punch', 'kick']);
  assert.equal(unequip(cfg, l, 1, town), null);
  assert.deepEqual(equippedMoves(l), ['kick']);
});

test('life skills are known but never slotted', () => {
  const l = starterLoadout(cfg, ['punch']);
  assert.equal(equip(cfg, l, known(), moves, 2, 'mining', town), 'not_slottable');
  assert.equal(l.has(2), false);
});
