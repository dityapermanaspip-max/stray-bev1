import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Recipe, Town } from '../../server/data/economy_repo.ts';
import { stackKey } from '../../server/inventory/bag.ts';
import { parseItem, type ItemCatalog } from '../../server/inventory/items.ts';
import { chanceRound, dueHours, firesAt } from '../../server/world/clock.ts';
import { townTick, type AreaHex, type TickInput } from '../../server/world/town_tick.ts';
import { cfg } from '../fixtures/battle_data.ts';
import { catalog as lootCatalog, loot } from '../fixtures/loot.ts';

const catalog: ItemCatalog = new Map([
  ...lootCatalog,
  ...[
    parseItem('grilled_chicken', 'food', 'meat', null, { weight: 0.4, value: 7, edible: true, goods: ['chicken'] }),
    parseItem('oak_log', 'material', 'log', null, { weight: 2, value: 3, stack: true, goods: ['wood'] }),
  ].map((item) => [item.name, item] as const),
]);
const grill: Recipe = { name: 'grill_chicken', facility: 'cook', level: 1, inputs: [{ item: 'chicken_meat', qty: 1 }], outputs: [{ item: 'grilled_chicken', qty: 1 }] };
const half = () => 0.5; // chance rounding: x.5 and above rounds up, below rounds down

function town(stock: Record<string, number>, purse = 100): Town {
  return {
    ref: 'town', purse, maxBuy: 100, specialties: [], taboo: [], facilities: {},
    stock: new Map(Object.entries(stock).map(([item, qty]) => [stackKey(item, 'common'), { item, quality: 'common', qty }])),
  };
}
const meadow = (natives: number, corrupted = 0): AreaHex => ({ ref: 'meadow', trees: 0, pop: [{ species: 'chicken', natives, corrupted, safe: 100, max: 1000 }] });
// 250 villagers: 100 workers (0.4), so a job share of 0.01 is one worker; food 0.8 per 100 -> 2 per tick, material 1.5.
const POP = 250;
const workers = (counts: Record<string, number>) => Object.fromEntries(Object.entries(counts).map(([job, n]) => [job, n / 100]));
const input = (t: Town, jobs: Record<string, number>, area: AreaHex[], rng = half): TickInput =>
  ({ cfg, catalog, loot, recipes: [grill], town: t, population: POP, jobs: workers(jobs), area, rng });
const qty = (t: Town, item: string) => t.stock.get(stackKey(item, 'common'))?.qty ?? 0;

test('the clock runs due world hours, caps the catch-up, and fires rules on their interval', () => {
  const H = 1000;
  assert.deepEqual(dueHours(2500, 0, H, 48), { run: 2, lastAt: 2000 });
  assert.deepEqual(dueHours(900, 0, H, 48), { run: 0, lastAt: 0 });
  assert.deepEqual(dueHours(100_500, 0, H, 48), { run: 48, lastAt: 100_000 }); // a long stop is not replayed
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((h) => firesAt(3, h)), [0, 0, 1, 0, 0, 1]);
  assert.equal(chanceRound(() => 0.2, 2.3), 3);
  assert.equal(chanceRound(() => 0.4, 2.3), 2);
});

test('villagers use stock by type and pay for it; they may eat into the safe stock', () => {
  const t = town({ chicken_meat: 2, oak_log: 20 });
  const r = townTick(input(t, {}, []));
  // food 2 / 1.9 (2 of 40: dear) = 1.05 -> 1 meat; material 1.5 / 1 (half full) = 1.5 -> 1 log (rounded by chance)
  assert.equal(qty(t, 'chicken_meat'), 1);
  assert.equal(qty(t, 'oak_log'), 19);
  assert.equal(r.used, 2);
  assert.equal(r.paid, Math.floor((6 + 3) * cfg.townTick.villagerPayShare)); // meat at 6, a log at 3
  assert.equal(t.purse, 100 + r.paid);
});

test('villagers share a type out over what is in stock and use more of what is cheap', () => {
  const t = town({ chicken_meat: 40, grilled_chicken: 10 }); // meat full (cheap), grilled scarce (dear)
  const r = townTick(input(t, {}, [], () => 0.99));
  // meat 2 x 40/50 / 0.5 = 3.2 -> 3; grilled 2 x 10/50 / 1.5 = 0.27 -> 0
  assert.equal(qty(t, 'chicken_meat'), 37);
  assert.equal(qty(t, 'grilled_chicken'), 10);
  assert.equal(r.used, 3);
});

test('hunters catch natives above the safe floor, bring in the loot table yield, and take them off the count', () => {
  const t = town({});
  const area = [meadow(600)];
  const r = townTick(input(t, { hunter: 1 }, area));
  // density (600 - 100) / 1000 = 0.5, per worker 2 -> 1 catch; yields 0.9 x 1.5 = 1.35 -> 1 meat, 0.8 x 4 = 3.2 -> 3 feathers
  assert.equal(r.caught, 1);
  assert.equal(area[0].pop[0].natives, 599);
  assert.deepEqual(r.hunted, [{ ref: 'meadow', species: 'chicken', n: 1 }]);
  assert.equal(qty(t, 'chicken_meat'), 1);
  assert.equal(qty(t, 'chicken_feather'), 3);
  assert.equal(qty(t, 'chicken_beak'), 0); // worthless: the town does not keep it
  assert.equal(t.purse, 100 - cfg.townTick.wages.hunter);
});

test('nothing above the floor, or a hex gone corrupt, means no catch', () => {
  assert.equal(townTick(input(town({}), { hunter: 3 }, [meadow(100)])).caught, 0);
  assert.equal(townTick(input(town({}), { hunter: 1 }, [meadow(600, 5000)])).caught, 0); // clean share 600 / 5600
});

test('an unpaid worker does not work', () => {
  const t = town({}, 1);
  const area = [meadow(1000)];
  const r = townTick(input(t, { hunter: 2 }, area));
  assert.equal(r.wages, 0);
  assert.equal(r.caught, 0);
  assert.equal(area[0].pop[0].natives, 1000);
});

test('woodcutters work the best forest in reach', () => {
  const t = town({});
  const forest: AreaHex = { ref: 'grove', trees: 0.15, pop: [] };
  const r = townTick(input(t, { woodcutter: 1 }, [meadow(100), forest]));
  assert.equal(r.logs, cfg.townTick.wood.perWorker);
  assert.equal(townTick(input(town({}), { woodcutter: 1 }, [meadow(100)])).logs, 0);
});

test('the town cook grills meat above the safe stock, as many batches as a worker manages', () => {
  const t = town({ chicken_meat: 10, grilled_chicken: 0 });
  const r = townTick(input(t, { cook: 1 }, [], () => 0.99));
  // safe meat 4 (0.1 x 40); villagers ate 1 (2 / 1.5 = 1.33, a high roll); per worker 2 batches
  assert.equal(r.batches, 2);
  assert.equal(qty(t, 'grilled_chicken'), 2);
  assert.equal(qty(t, 'chicken_meat'), 7);
  const low = town({ chicken_meat: 4 });
  assert.equal(townTick(input(low, { cook: 1 }, [], () => 0.99)).batches, 0);
});

test('the workforce is a share of the population; common jobs bring nothing to the store and earn no wage', () => {
  const t = town({});
  const r = townTick({ ...input(t, {}, [meadow(600)]), jobs: { farmer: 0.5, hunter: 0.01 } });
  assert.equal(r.caught, 1); // one hunter (250 x 0.4 x 0.01)
  assert.equal(r.wages, cfg.townTick.wages.hunter); // farmers are not paid from the store purse
});
