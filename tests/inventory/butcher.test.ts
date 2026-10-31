import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addItem, countOf, emptyInventory, type Inventory } from '../../server/inventory/bag.ts';
import { butcherCarcass, carcassPrice, sellCarcass, type ButcherJob, type ButcherResult } from '../../server/inventory/butcher.ts';
import { carcassPieceData } from '../../server/inventory/carcass.ts';
import { coinTotal } from '../../server/inventory/money.ts';
import { cfg } from '../fixtures/battle_data.ts';
import { catalog, chicken, HOUR, loot, MOVES, progress } from '../fixtures/loot.ts';

function withCarcass(corrupted = false): Inventory {
  const inv = emptyInventory();
  addItem(catalog, inv, 'chicken_carcass', 1, () => 'c1', null, carcassPieceData(chicken({ corrupted })));
  return inv;
}

const job = (inv: Inventory, over: Partial<ButcherJob>): ButcherJob => ({
  cfg, catalog, loot, moves: MOVES, inv, pieceId: 'c1', mode: 'npc_pay', cutter: null, now: 0, rng: () => 0, ...over,
});

test('the butcher charges by carcass weight and refuses an empty purse', () => {
  const inv = withCarcass();
  assert.equal(butcherCarcass(job(inv, {})), 'cannot_pay');
  assert.equal(inv.pieces.length, 1);
  addItem(catalog, inv, 'copper_coin', 10);
  const result = butcherCarcass(job(inv, {})) as ButcherResult;
  assert.equal(result.fee, 6);
  assert.equal(coinTotal(cfg, inv), 4);
  assert.equal(inv.pieces.length, 0);
  assert.ok(countOf(inv, 'chicken_feather') > 0);
  assert.deepEqual(result.lines, ['butcher.paid']);
});

test('paying in parts: each part unit the butcher keeps is a cut_share roll', () => {
  const inv = withCarcass();
  const result = butcherCarcass(job(inv, { mode: 'npc_cut' })) as ButcherResult; // rng 0: every roll keeps
  assert.equal(result.fee, 0);
  assert.deepEqual(result.drops, []);
  assert.ok(result.kept.length > 0);
  assert.deepEqual(result.lines, ['butcher.cut', 'butcher.junk']);
  assert.equal(inv.pieces.length, 0);
});

test('butchering yourself needs the skill and a blade, and grows the skill', () => {
  const inv = withCarcass();
  assert.equal(butcherCarcass(job(inv, { mode: 'self', cutter: { progress: progress(null), inv, luck: 0 } })), 'no_skill');
  const p = progress(1);
  assert.equal(butcherCarcass(job(inv, { mode: 'self', cutter: { progress: p, inv, luck: 0 } })), 'no_tool');
  addItem(catalog, inv, 'iron_knife', 1, () => 'k1');
  const result = butcherCarcass(job(inv, { mode: 'self', cutter: { progress: p, inv, luck: 0 } })) as ButcherResult;
  assert.deepEqual(result.lines[0], 'butcher.self');
  const known = p.moves.get('butchery')!;
  assert.ok(known.level > 1 || known.exp > 0);
});

test('a party member can do the cutting with their own knife', () => {
  const inv = withCarcass();
  const helper = emptyInventory();
  addItem(catalog, helper, 'iron_knife', 1, () => 'k2');
  const result = butcherCarcass(job(inv, { mode: 'self', cutter: { progress: progress(5), inv: helper, luck: 0 } }));
  assert.equal(typeof result, 'object');
  assert.ok(countOf(inv, 'chicken_feather') > 0);
  assert.equal(countOf(helper, 'chicken_feather'), 0);
});

test('shops pay less than the butcher, refuse corrupted carcasses, and rot lowers the price', () => {
  assert.equal(carcassPrice(cfg, catalog, withCarcass(), 'c1', 'shop', 0), 3);
  assert.equal(carcassPrice(cfg, catalog, withCarcass(), 'c1', 'butcher', 0), 6);
  assert.equal(carcassPrice(cfg, catalog, withCarcass(true), 'c1', 'shop', 0), 'refused');
  assert.equal(carcassPrice(cfg, catalog, withCarcass(true), 'c1', 'butcher', 10 * HOUR), 3);
  const inv = withCarcass();
  const sold = sellCarcass(cfg, catalog, inv, 'c1', 'butcher', 0);
  assert.deepEqual(sold, { price: 6, lines: ['butcher.bought'] });
  assert.equal(coinTotal(cfg, inv), 6);
  assert.equal(inv.pieces.length, 0);
});

test('the town butcher cuts with their own luck, you cut with yours', () => {
  const rare = { ...loot, bySpecies: new Map([['chicken', { native: [{ item: 'chicken_beak', permille: 2, min: 1, max: 1 }], corrupted: [] }]]) };
  const roll = () => 0.011; // 11 per mille: passes 2 x 0.96 + butcher luck 10, fails with luck 0
  const paid = withCarcass();
  addItem(catalog, paid, 'copper_coin', 10);
  assert.equal((butcherCarcass(job(paid, { loot: rare, rng: roll })) as ButcherResult).drops.length, 1);
  const own = withCarcass();
  addItem(catalog, own, 'iron_knife', 1, () => 'k3');
  const unlucky = butcherCarcass(job(own, { loot: rare, rng: roll, mode: 'self', cutter: { progress: progress(12), inv: own, luck: 0 } }));
  assert.deepEqual((unlucky as ButcherResult).drops, []);
});
