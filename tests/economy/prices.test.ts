import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buyPrice, capacityOf, craftFee, sellPrice, startQty, stockMult, tradeable } from '../../server/economy/prices.ts';
import type { ItemDef } from '../../server/inventory/items.ts';
import { cfg } from '../fixtures/battle_data.ts';

const e = cfg.economy;
const item = (over: Partial<ItemDef>): ItemDef => ({
  name: 'x', type: 'food', shape: null, material: null, weight: 1, maxDurability: null, defaultQuality: 'common', stack: true,
  value: 3, goods: [], taboo: false, edible: true, rotsTo: null, toolType: null, ammoType: null, meal: null, carcassOf: null, wield: null, worn: null, effects: [], ...over,
});
const meat = item({ name: 'chicken_meat', goods: ['chicken'] });
const sword = item({ name: 'iron_sword', type: 'weapon', value: 120, stack: false });

test('price is base at half stock, double when empty, half when full', () => {
  assert.equal(stockMult(e, 20, 40), 1);
  assert.equal(stockMult(e, 0, 40), 2);
  assert.equal(stockMult(e, 40, 40), 0.5);
  assert.equal(stockMult(e, 80, 40), 0.5);
  assert.equal(stockMult(e, 10, 40), 1.5);
  assert.equal(sellPrice(e, sword, 'common', 0, 3), 240);
  assert.equal(sellPrice(e, sword, 'fine', 2, 4), 192);
  assert.equal(sellPrice(e, item({ value: 1 }), 'common', 40, 40), 1); // never below one copper
});

test('a town keeps far more of its specialty: cheaper there, and a sale barely moves the price', () => {
  const home = { cap: capacityOf(e, meat, ['chicken']), qty: startQty(e, meat, ['chicken']) };
  const away = { cap: capacityOf(e, meat, ['wood']), qty: startQty(e, meat, ['wood']) };
  assert.deepEqual([home.cap, home.qty, away.cap, away.qty], [120, 72, 40, 14]);
  const priceAt = (t: { cap: number }, qty: number) => sellPrice(e, item({ value: 30, goods: ['chicken'] }), 'common', qty, t.cap);
  assert.ok(priceAt(home, home.qty) < priceAt(away, away.qty)); // 27 against 39
  assert.ok(priceAt(home, home.qty) - priceAt(home, home.qty + 10) < priceAt(away, away.qty) - priceAt(away, away.qty + 10));
});

test('the shop pays 70% of its own price, less for worn or stale goods', () => {
  assert.equal(buyPrice(e, 100), 70);
  assert.equal(buyPrice(e, 100, 0.5), 35);
  assert.equal(buyPrice(e, 1), 0);
});

test('craft fee is half the value added, at least one copper; coins and worthless things are not traded', () => {
  assert.equal(craftFee(e, 3, 7), 2);
  assert.equal(craftFee(e, 3, 4), 1);
  assert.equal(craftFee(e, 9, 15), 3);
  assert.equal(tradeable(e, item({ type: 'coin', value: 1 })), false);
  assert.equal(tradeable(e, item({ value: 0 })), false);
  assert.equal(tradeable(e, meat), true);
});

test('a town taboo refuses item types, shapes and goods families (elves: meat and carcasses)', () => {
  const meat = item({ type: 'food', shape: 'meat', goods: ['chicken'] });
  const carcass = item({ type: 'carcass', shape: 'carcass', goods: ['chicken'] });
  const herb = item({ type: 'food', shape: 'herb', goods: [] });
  const elf = ['meat', 'carcass'];
  assert.deepEqual([meat, carcass, herb].map((x) => tradeable(e, x, elf)), [false, false, true]);
  assert.equal(tradeable(e, meat), true);
  assert.equal(tradeable(e, meat, ['chicken']), false);
});
