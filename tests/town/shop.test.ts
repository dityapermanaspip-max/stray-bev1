import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Recipe, Town } from '../../server/data/economy_repo.ts';
import { startQty } from '../../server/economy/prices.ts';
import { addItem, countOf, emptyInventory, stackKey } from '../../server/inventory/bag.ts';
import { parseItem, type ItemCatalog } from '../../server/inventory/items.ts';
import { addCoins, coinTotal } from '../../server/inventory/money.ts';
import { craftOnce, recipeViews, recipesAt } from '../../server/town/craft.ts';
import { buyFromShop, sellToShop, shopOffers, shopWares, townPrice, type Trade } from '../../server/town/shop.ts';
import { cfg } from '../fixtures/battle_data.ts';
import { catalog as lootCatalog } from '../fixtures/loot.ts';

const catalog: ItemCatalog = new Map([
  ...lootCatalog,
  ...[
    parseItem('grilled_chicken', 'food', 'meat', null, { weight: 0.4, value: 7, edible: true, goods: ['chicken'] }),
    parseItem('gold_blade', 'weapon', 'sword', null, { weight: 3, value: 300, max_durability: 100, wield: { weapon_type: 'sword', power: 5, hands: 1 } }),
    parseItem('oak_log', 'material', 'log', null, { weight: 4, value: 3, stack: true, goods: ['wood'] }),
    parseItem('cat_meat', 'food', 'meat', null, { weight: 0.5, value: 2, edible: true, taboo: true }),
    parseItem('cat_pelt', 'part', 'pelt', null, { weight: 0.6, value: 5 }),
    parseItem('raw_hide', 'material', 'hide', null, { weight: 1, value: 7 }),
    parseItem('leather', 'material', 'leather', null, { weight: 0.5, value: 5 }),
  ].map((item) => [item.name, item] as const),
]);
catalog.set('chicken_meat', { ...catalog.get('chicken_meat')!, goods: ['chicken'] });

const NOW = 1_000_000_000;
const CRAFTED = new Set(['grilled_chicken']); // what recipes make: on the shelf
const noSafe = { ...cfg, economy: { ...cfg.economy, safeFill: 0, specialtySafeFill: 0 } }; // shelf tests without a safe stock

function town(over: Partial<Town> = {}): Town {
  const t: Town = { ref: 'dev', purse: 1000, maxBuy: 100, specialties: ['chicken'], facilities: {}, stock: new Map(), ...over };
  for (const name of ['chicken_meat', 'grilled_chicken', 'oak_log', 'gold_blade', 'chicken_carcass']) {
    const def = catalog.get(name)!;
    t.stock.set(stackKey(name, def.defaultQuality), { item: name, quality: def.defaultQuality, qty: startQty(cfg.economy, def, t.specialties) });
  }
  return t;
}

function bag(copper: number) {
  const inv = emptyInventory();
  addCoins(cfg, catalog, inv, copper);
  return inv;
}

const meatKey = stackKey('chicken_meat', 'common');

test('selling pays the shop share of its price, shelves the item, and lowers what it pays next', () => {
  const t = town();
  const inv = bag(0);
  addItem(catalog, inv, 'chicken_meat', 30);
  const first = shopOffers(cfg, catalog, t, inv, NOW).find((o) => o.ref === meatKey)!;
  assert.equal(first.price, Math.floor(townPrice(cfg, catalog, t, 'chicken_meat', 'common', 1)! * cfg.economy.buyShare));
  const sold = sellToShop(cfg, catalog, t, inv, meatKey, NOW) as Trade;
  assert.equal(sold.line, 'town.shop.sold');
  assert.deepEqual(sold.deltas, [{ item: 'chicken_meat', quality: 'common', qty: 1 }]);
  assert.equal(coinTotal(cfg, inv), first.price);
  assert.equal(t.purse, 1000 - first.price);
  for (let i = 0; i < 28; i++) sellToShop(cfg, catalog, t, inv, meatKey, NOW);
  assert.ok(shopOffers(cfg, catalog, t, inv, NOW).find((o) => o.ref === meatKey)!.price < first.price);
});

test('villagers will not pay above their ceiling, nor past an empty till', () => {
  const inv = bag(0);
  addItem(catalog, inv, 'gold_blade', 1);
  addItem(catalog, inv, 'oak_log', 1);
  const blade = inv.pieces[0].id;
  assert.equal(sellToShop(cfg, catalog, town(), inv, blade, NOW), 'town.shop.too_dear');
  assert.equal(sellToShop(cfg, catalog, town({ purse: 0 }), inv, stackKey('oak_log', 'common'), NOW), 'town.shop.no_money');
  assert.equal(countOf(inv, 'oak_log'), 1);
});

test('worn gear is never offered; a worn-down piece fetches less; corrupted carcasses are refused', () => {
  const t = town({ maxBuy: 1000 });
  const inv = bag(0);
  addItem(catalog, inv, 'gold_blade', 2);
  inv.pieces[1].durability = 50;
  const [fresh, worn] = inv.pieces.map((p) => shopOffers(cfg, catalog, t, inv, NOW).find((o) => o.ref === p.id)!.price);
  assert.ok(worn < fresh);
  inv.pieces[0].slot = 'hand';
  assert.equal(shopOffers(cfg, catalog, t, inv, NOW).some((o) => o.ref === inv.pieces[0].id), false);
  assert.equal(sellToShop(cfg, catalog, t, inv, inv.pieces[0].id, NOW), 'town.shop.nothing');
  addItem(catalog, inv, 'chicken_carcass', 1, undefined, null, { species: 'chicken', corrupted: true, killed_at: NOW });
  assert.equal(sellToShop(cfg, catalog, t, inv, inv.pieces[2].id, NOW), 'shop.refuse_corrupted');
});

test('the shelf holds finished goods only; buying pays the shelf price into the purse, one by one', () => {
  const t = town();
  const grilledKey = stackKey('grilled_chicken', 'common');
  t.stock.get(grilledKey)!.qty = 1;
  const wares = shopWares(noSafe, catalog, t, CRAFTED).map((w) => w.item).sort();
  assert.deepEqual(wares, ['gold_blade', 'grilled_chicken']); // no raw meat, logs or carcasses
  assert.equal(buyFromShop(noSafe, catalog, t, bag(100), meatKey, CRAFTED), 'town.shop.out');
  const price = townPrice(noSafe, catalog, t, 'grilled_chicken', 'common')!;
  assert.equal(price, 14); // one left of 120: nearly double the base 7
  const inv = bag(price);
  const bought = buyFromShop(noSafe, catalog, t, inv, grilledKey, CRAFTED) as Trade;
  assert.equal(bought.purseDelta, price);
  assert.equal(countOf(inv, 'grilled_chicken'), 1);
  assert.equal(coinTotal(cfg, inv), 0);
  assert.equal(buyFromShop(noSafe, catalog, t, bag(100), grilledKey, CRAFTED), 'town.shop.out');
  assert.equal(buyFromShop(noSafe, catalog, town(), bag(0), grilledKey, CRAFTED), 'town.shop.cannot_pay');
});

test('no shop takes or stocks taboo meat', () => {
  const t = town();
  t.stock.set(stackKey('cat_meat', 'common'), { item: 'cat_meat', quality: 'common', qty: 5 });
  const inv = bag(0);
  addItem(catalog, inv, 'cat_meat', 1);
  assert.equal(shopOffers(cfg, catalog, t, inv, NOW).length, 0);
  assert.equal(sellToShop(cfg, catalog, t, inv, stackKey('cat_meat', 'common'), NOW), 'town.shop.nothing');
  assert.equal(shopWares(cfg, catalog, t, new Set(['cat_meat'])).some((w) => w.item === 'cat_meat'), false);
});

const recipe = (name: string, facility: string, inputs: [string, number][], outputs: [string, number][], level = 1): Recipe => ({
  name, facility, level, inputs: inputs.map(([item, qty]) => ({ item, qty })), outputs: outputs.map(([item, qty]) => ({ item, qty })),
});

test('the cook grills meat for half the value it adds', () => {
  const grill = recipe('grill_chicken', 'cook', [['chicken_meat', 1]], [['grilled_chicken', 1]]);
  const inv = bag(5);
  assert.equal(craftOnce(cfg, catalog, grill, inv), 'town.craft.missing');
  addItem(catalog, inv, 'chicken_meat', 1);
  assert.deepEqual(recipeViews(cfg, catalog, [grill], inv)[0].inputs, [{ item: 'chicken_meat', qty: 1, have: 1 }]);
  assert.deepEqual(craftOnce(cfg, catalog, grill, inv), { fee: 2, line: 'town.craft.done' });
  assert.equal(countOf(inv, 'grilled_chicken'), 1);
  assert.equal(coinTotal(cfg, inv), 3);
  const poor = bag(1);
  addItem(catalog, poor, 'chicken_meat', 1);
  assert.equal(craftOnce(cfg, catalog, grill, poor), 'town.craft.cannot_pay');
  assert.equal(countOf(poor, 'chicken_meat'), 1);
});

test('crafts chain (pelt -> hide -> leather), and a craftsman only makes what their level allows', () => {
  const scrape = recipe('scrape_pelt', 'tanner', [['cat_pelt', 1]], [['raw_hide', 1]]);
  const tan = recipe('tan_hide', 'tanner', [['raw_hide', 1], ['oak_log', 1]], [['leather', 3]]);
  const master = recipe('fine_leather', 'tanner', [['leather', 2]], [['raw_hide', 1]], 3);
  const inv = bag(10);
  addItem(catalog, inv, 'cat_pelt', 1);
  addItem(catalog, inv, 'oak_log', 1);
  craftOnce(cfg, catalog, scrape, inv);
  assert.deepEqual(craftOnce(cfg, catalog, tan, inv), { fee: 3, line: 'town.craft.done' }); // 7 + 3 in, 15 out
  assert.equal(countOf(inv, 'leather'), 3);
  assert.deepEqual(recipesAt([scrape, tan, master], 'tanner', 1).map((r) => r.name), ['scrape_pelt', 'tan_hide']);
  assert.equal(recipesAt([scrape, tan, master], 'tanner', 3).length, 3);
  assert.equal(recipesAt([scrape, tan, master], 'cook', 5).length, 0);
});

test('buying the last one and selling it straight back always loses', () => {
  for (const [item, qty] of [['gold_blade', 1], ['grilled_chicken', 1], ['grilled_chicken', 5]] as const) {
    const t = town({ maxBuy: 10000 });
    t.stock.get(stackKey(item, 'common'))!.qty = qty;
    const price = townPrice(noSafe, catalog, t, item, 'common')!;
    const inv = bag(price);
    buyFromShop(noSafe, catalog, t, inv, stackKey(item, 'common'), CRAFTED);
    const ref = inv.pieces[0]?.id ?? stackKey(item, 'common');
    sellToShop(noSafe, catalog, t, inv, ref, NOW);
    assert.ok(coinTotal(cfg, inv) < price, `${item}: paid ${price}, got ${coinTotal(cfg, inv)} back`);
  }
});

test('the shop never sells below the safe stock the villagers keep', () => {
  const t = town();
  const key = stackKey('grilled_chicken', 'common');
  const safe = Math.round(120 * cfg.economy.specialtySafeFill); // a specialty: capacity 120
  t.stock.get(key)!.qty = safe + 2;
  assert.equal(shopWares(cfg, catalog, t, CRAFTED).find((w) => w.key === key)!.qty, 2);
  const inv = bag(500);
  buyFromShop(cfg, catalog, t, inv, key, CRAFTED);
  buyFromShop(cfg, catalog, t, inv, key, CRAFTED);
  assert.equal(buyFromShop(cfg, catalog, t, inv, key, CRAFTED), 'town.shop.out');
  assert.equal(t.stock.get(key)!.qty, safe);
  assert.equal(shopWares(cfg, catalog, t, CRAFTED).some((w) => w.key === key), false);
});
