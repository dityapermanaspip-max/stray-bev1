import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defenseReduction } from '../../server/battle/damage.ts';
import {
  addItem, carriedWeight, conditionTier, countOf, emptyInventory, loadTier, removeItem, stackKey, stackedValue, wearFactor,
} from '../../server/inventory/bag.ts';
import { armorDefense, itemWeight } from '../../server/inventory/items.ts';
import { cfg } from '../fixtures/battle_data.ts';
import { catalog } from '../fixtures/items.ts';

const SLOTS = ['head', 'body', 'hands', 'pants', 'feet'];
const setDefense = (material: string) => SLOTS.reduce((sum, s) => sum + armorDefense(cfg, catalog.get(`${material}_${s}`)!), 0);
const pct = (defense: number) => Math.round(defenseReduction(cfg.combat, defense) * 100);

test('full armor sets match the agreed table: leather 13%, iron 26%, body pieces 5% and 11%', () => {
  assert.equal(pct(setDefense('leather')), 13);
  assert.equal(pct(setDefense('iron')), 26);
  assert.equal(pct(armorDefense(cfg, catalog.get('leather_body')!)), 5);
  assert.equal(pct(armorDefense(cfg, catalog.get('iron_body')!)), 11);
});

test('armor weight follows the body shares: iron set 30, iron body 10.5', () => {
  const ironSet = SLOTS.reduce((sum, s) => sum + itemWeight(cfg, catalog.get(`iron_${s}`)!), 0);
  assert.ok(Math.abs(ironSet - 30) < 1e-9);
  assert.ok(Math.abs(itemWeight(cfg, catalog.get('iron_body')!) - 10.5) < 1e-9);
});

test('stacks count up, gear becomes pieces at full durability with the default quality', () => {
  const inv = emptyInventory();
  let n = 0;
  assert.equal(addItem(catalog, inv, 'river_stone', 3), null);
  assert.equal(addItem(catalog, inv, 'river_stone', 2), null);
  assert.equal(addItem(catalog, inv, 'iron_sword', 2, () => `p${++n}`), null);
  assert.equal(countOf(inv, 'river_stone'), 5);
  assert.deepEqual(inv.pieces.map((p) => [p.id, p.durability, p.quality]), [['p1', 120, 'common'], ['p2', 120, 'common']]);
  assert.equal(inv.stacks.get(stackKey('river_stone', 'improvised'))!.slot, null);
  addItem(catalog, inv, 'river_stone', 2, undefined, 'fine'); // another quality is its own stack
  assert.equal(inv.stacks.size, 2);
  assert.equal(countOf(inv, 'river_stone'), 7);
  assert.equal(addItem(catalog, inv, 'nothing', 1), 'unknown_item');
  assert.equal(addItem(catalog, inv, 'river_stone', 0), 'bad_qty');
  assert.equal(removeItem(inv, 'river_stone', 9), 'not_held');
  assert.equal(removeItem(inv, 'river_stone', 7), null);
  assert.equal(countOf(inv, 'river_stone'), 0);
});

test('load tiers for an all-5 person (carry 90): light, carrying, slowed, stuck', () => {
  const inv = emptyInventory();
  for (const s of SLOTS) addItem(catalog, inv, `iron_${s}`, 1);
  assert.ok(Math.abs(carriedWeight(cfg, catalog, inv) - 30) < 1e-9);
  assert.equal(loadTier(cfg, 30, 90), 1); // a third of the limit
  assert.equal(loadTier(cfg, 36, 90), 2); // 0.4
  assert.equal(loadTier(cfg, 63, 90), 3); // 0.7
  assert.equal(loadTier(cfg, 90, 90), 4);
});

test('wear: new 1, just above broken about 0.5, broken 0; condition tiers 0-4', () => {
  assert.equal(wearFactor(cfg, 120, 120), 1);
  assert.equal(wearFactor(cfg, 60, 120), 0.75);
  assert.ok(Math.abs(wearFactor(cfg, 1, 120) - 0.504) < 0.001);
  assert.equal(wearFactor(cfg, 0, 120), 0);
  assert.deepEqual([0, 10, 40, 70, 100, 120].map((d) => conditionTier(cfg, d, 120)), [0, 1, 2, 3, 4, 4]);
});

test('ten rings of the same small effect add up to about two', () => {
  const total = stackedValue(cfg, Array(10).fill(0.02));
  assert.ok(Math.abs(total - 0.04) < 0.001, `total ${total}`);
  assert.equal(stackedValue(cfg, [0.01, 0.04]), 0.045); // strongest first
});
