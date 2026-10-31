import assert from 'node:assert/strict';
import { test } from 'node:test';
import { carriedWeight, countOf, emptyInventory } from '../../server/inventory/bag.ts';
import { shareCarcasses } from '../../server/inventory/carcass.ts';
import { butcherSkill, freshnessTier, rollLoot } from '../../server/inventory/loot.ts';
import { addCoins, coinTotal, payCoins } from '../../server/inventory/money.ts';
import { goodChance } from '../../server/util/luck.ts';
import { cfg } from '../fixtures/battle_data.ts';
import { catalog, chicken, HOUR, loot } from '../fixtures/loot.ts';

const always = () => 0;
const plain = { ...cfg, loot: { ...cfg.loot, qualityNudgePermille: 0 } }; // no quality nudge
const summary = (drops: { item: string; qty: number; quality: string }[]) =>
  drops.map((d) => `${d.item}@${d.quality}x${d.qty}`).sort();

test('freshness tiers come from the hours since the kill', () => {
  assert.deepEqual([0, 5.9, 6, 30, 72].map((h) => freshnessTier(cfg, 0, h * HOUR)), [1, 1, 2, 3, 4]);
});

test('butchery skill raises drop chance and part quality', () => {
  assert.deepEqual(butcherSkill(cfg, 1), { chanceMult: 0.63, qualitySteps: 0 });
  assert.equal(butcherSkill(cfg, 12).qualitySteps, 1);
  assert.equal(butcherSkill(cfg, 20).qualitySteps, 2);
  assert.ok(Math.abs(butcherSkill(cfg, 20).chanceMult - 1.2) < 1e-9);
});

test('a natural carcass gives parts and meat but never essence', () => {
  const drops = rollLoot(plain, catalog, loot, chicken(), 1, 0, 0, always);
  assert.deepEqual(summary(drops), ['chicken_beak@commonx1', 'chicken_feather@commonx2', 'chicken_meat@commonx1']);
});

test('essence comes only from corrupted creatures, its quality from their strength, its chance not from skill', () => {
  const rng = () => 0.69; // roll 690: passes essence 700, fails tainted meat 800 x skill 0.63
  assert.deepEqual(summary(rollLoot(plain, catalog, loot, chicken({ corrupted: true }), 1, 0, 0, rng)), ['essence@crudex1']);
  const strong = rollLoot(plain, catalog, loot, chicken({ corrupted: true, totalStats: 30 }), 1, 0, 0, always);
  assert.ok(summary(strong).includes('essence@finex1'));
});

test('rot turns meat rotten and drops part quality; skill lifts quality', () => {
  const rotten = rollLoot(plain, catalog, loot, chicken(), 1, 0, 80 * HOUR, always);
  assert.ok(summary(rotten).includes('rotten_meat@crudex1'));
  assert.ok(!summary(rotten).some((d) => d.startsWith('chicken_meat')));
  const master = rollLoot(plain, catalog, loot, chicken(), 18, 0, 0, always);
  assert.ok(summary(master).includes('chicken_feather@masterworkx2'));
  assert.deepEqual(rollLoot(plain, catalog, loot, chicken(), 20, 0, 80 * HOUR, () => 0.99), []);
});

test('luck adds flat per-mille to each drop and to the quality nudge', () => {
  const rare = { ...loot, bySpecies: new Map([['chicken', { native: [{ item: 'chicken_beak', permille: 2, min: 1, max: 1 }], corrupted: [] }]]) };
  const cut = (luck: number, roll: number) => rollLoot(plain, catalog, rare, chicken(), 14, luck, 0, () => roll); // skill x1.02
  assert.deepEqual(cut(0, 0.006), []);
  assert.equal(cut(5, 0.006).length, 1); // 2 + 5 = 7 per mille, roll 6 passes
  assert.equal(goodChance(cfg.luck, cfg.loot.qualityNudgePermille, 30), 50);
  let i = 0;
  const seq = [0, 0, 0.04]; // drop passes, qty, nudge roll 40 < 20 + 30
  const nudged = rollLoot(cfg, catalog, rare, chicken(), 1, 30, 0, () => seq[i++] ?? 0.99);
  assert.deepEqual(summary(nudged), ['chicken_beak@finex1']);
});

test('coins add largest first and pay smallest first with change', () => {
  const inv = emptyInventory();
  addCoins(cfg, catalog, inv, 10250);
  assert.deepEqual([countOf(inv, 'gold_coin'), countOf(inv, 'silver_coin'), countOf(inv, 'copper_coin')], [1, 2, 50]);
  assert.equal(payCoins(cfg, catalog, inv, 160), true);
  assert.equal(coinTotal(cfg, inv), 10090);
  assert.equal(payCoins(cfg, catalog, inv, 20000), false);
  assert.equal(coinTotal(cfg, inv), 10090);
});

test('carcasses go to whoever has the most spare weight, the rest stay on the field', () => {
  const a = { id: 'a', inv: emptyInventory(), maxWeight: 10 };
  const b = { id: 'b', inv: emptyInventory(), maxWeight: 5 };
  const lizard = chicken({ species: 'lizard' });
  let n = 0;
  const shared = shareCarcasses(cfg, catalog, [a, b], [lizard, chicken(), lizard], () => `c${++n}`);
  assert.deepEqual(shared.taken, [{ takerId: 'a', item: 'lizard_carcass' }, { takerId: 'b', item: 'chicken_carcass' }]);
  assert.equal(shared.left.length, 1);
  assert.equal(carriedWeight(cfg, catalog, a.inv), 6);
  assert.equal(a.inv.pieces[0].data.species, 'lizard');
});
