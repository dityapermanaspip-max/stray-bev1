import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Craft, Town } from '../../server/data/economy_repo.ts';
import { startQty } from '../../server/economy/prices.ts';
import { addItem, countOf, emptyInventory, stackKey } from '../../server/inventory/bag.ts';
import { parseItem, type ItemCatalog } from '../../server/inventory/items.ts';
import { addCoins, coinTotal } from '../../server/inventory/money.ts';
import { craftOnce, recipesOf } from '../../server/town/craft.ts';
import { buyFromShop, sellToShop, shopOffers, shopWares, townPrice, type Trade } from '../../server/town/shop.ts';
import { cfg } from '../fixtures/battle_data.ts';
import { catalog as lootCatalog } from '../fixtures/loot.ts';

const catalog: ItemCatalog = new Map([
  ...lootCatalog,
  ...[
    parseItem('grilled_chicken', 'food', 'meat', null, { weight: 0.4, value: 7, edible: true, goods: ['chicken'] }),
    parseItem('gold_blade', 'weapon', 'sword', null, { weight: 3, value: 300, max_durability: 100, wield: { weapon_type: 'sword', power: 5, hands: 1 } }),
    parseItem('oak_log', 'material', 'log', null, { weight: 4, value: 3, stack: true, goods: ['wood'] }),
  ].map((item) => [item.name, item] as const),
]);
catalog.set('chicken_meat', { ...catalog.get('chicken_meat')!, goods: ['chicken'] });

const NOW = 1_000_000_000;

function town(over: Partial<Town> = {}): Town {
  const t: Town = { ref: 'dev', purse: 1000, maxBuy: 100, specialties: ['chicken'], stock: new Map(), ...over };
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
  assert.equal(first.price, Math.floor(townPrice(cfg, catalog, t, 'chicken_meat', 'common')! * cfg.economy.buyShare));
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

test('buying pays the shelf price into the purse and empties the shelf one by one; carcasses are not on it', () => {
  const t = town();
  t.stock.get(meatKey)!.qty = 1;
  const price = townPrice(cfg, catalog, t, 'chicken_meat', 'common')!;
  assert.equal(price, 6); // one left of 120: nearly double the base 3
  assert.equal(shopWares(cfg, catalog, t).some((w) => w.item === 'chicken_carcass'), false);
  const inv = bag(price);
  const bought = buyFromShop(cfg, catalog, t, inv, meatKey) as Trade;
  assert.equal(bought.purseDelta, price);
  assert.equal(countOf(inv, 'chicken_meat'), 1);
  assert.equal(coinTotal(cfg, inv), 0);
  assert.equal(buyFromShop(cfg, catalog, t, bag(100), meatKey), 'town.shop.out');
  assert.equal(buyFromShop(cfg, catalog, town(), bag(0), meatKey), 'town.shop.cannot_pay');
});

test('the cook grills meat for half the value it adds', () => {
  const grill: Craft = { name: 'grill_chicken', craftsman: 'cook', output: 'grilled_chicken', outputQty: 1, inputs: [{ item: 'chicken_meat', qty: 1 }] };
  const inv = bag(5);
  assert.equal(craftOnce(cfg, catalog, grill, inv), 'town.craft.missing');
  addItem(catalog, inv, 'chicken_meat', 1);
  assert.deepEqual(recipesOf(cfg, catalog, [grill], 'cook', inv)[0].inputs, [{ item: 'chicken_meat', qty: 1, have: 1 }]);
  assert.deepEqual(craftOnce(cfg, catalog, grill, inv), { fee: 2, line: 'town.craft.done' });
  assert.equal(countOf(inv, 'grilled_chicken'), 1);
  assert.equal(coinTotal(cfg, inv), 3);
  assert.equal(craftOnce(cfg, catalog, grill, bag(1)), 'town.craft.missing');
  const poor = bag(1);
  addItem(catalog, poor, 'chicken_meat', 1);
  assert.equal(craftOnce(cfg, catalog, grill, poor), 'town.craft.cannot_pay');
  assert.equal(countOf(poor, 'chicken_meat'), 1);
});
