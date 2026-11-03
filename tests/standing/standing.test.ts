import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canHaggle, fameShares, favorTier, generousBuy, generousOutcome, generousSell, haggleChance, modBuy, modSell, optionOpen, priceMods,
  type Standing,
} from '../../server/standing/standing.ts';
import { shopAdjust } from '../../server/standing/shop_standing.ts';
import { cfg } from '../fixtures/battle_data.ts';

const S = cfg.standing; // base threshold 10 here: tiers at 10, 24, 43, 69...; haggle needs tier 1; charm counts 1 favor per point
const who = (over: Partial<Standing> = {}): Standing => ({ favor: 0, base: 10, capTier: 10, fame: 0, charm: 0, pushover: false, haggle: 'open', ...over });

test('favor tiers follow each NPC own thresholds, held down by the pair cap', () => {
  assert.deepEqual([-5, 0, 9, 10, 23, 24, 43, 5000].map((f) => favorTier(S, who(), f)), [0, 0, 0, 1, 1, 2, 3, 10]);
  assert.equal(favorTier(S, who({ capTier: 9 }), 5000), 9);
  assert.equal(favorTier(S, who({ base: 20 }), 46), 1); // a harder NPC: tier 2 needs 47
});

test('charm lowers the gate: a charming stranger may haggle, a plain one may not', () => {
  assert.equal(optionOpen(S, 'haggle', who({ favor: 5, charm: 4 })), false); // 9
  assert.equal(optionOpen(S, 'haggle', who({ favor: 5, charm: 5 })), true); // 10
  assert.equal(optionOpen(S, 'haggle', who({ favor: 10 })), true);
  assert.equal(optionOpen(S, 'recruit', who({ favor: 100 })), false); // unknown options stay closed
});

test('one haggle per visit: open only when not tried yet', () => {
  assert.equal(canHaggle(S, who({ favor: 10 })), true);
  assert.equal(canHaggle(S, who({ favor: 10, haggle: 'won' })), false);
  assert.equal(canHaggle(S, who({ favor: 10, haggle: 'spent' })), false);
});

test('haggle chance: 300 + 20 per charm, minus 200 for a pushover, kept between 50 and 900', () => {
  assert.equal(haggleChance(S, 5, false), 400);
  assert.equal(haggleChance(S, 5, true), 200);
  assert.equal(haggleChance(S, 0, true), 100);
  assert.equal(haggleChance({ ...S, haggle: { ...S.haggle, basePermille: 100 } }, 0, true), 50); // floor
  assert.equal(haggleChance(S, 100, false), 900);
});

test('a won haggle moves prices 10% for the visit; the pushover mark moves them 10% the other way', () => {
  const won = priceMods(S, who({ haggle: 'won' }));
  assert.equal(modBuy(100, won), 90);
  assert.equal(modSell(70, won), 77);
  const soft = priceMods(S, who({ pushover: true }));
  assert.equal(modBuy(100, soft), 110);
  assert.equal(modSell(70, soft), 63);
  assert.equal(modBuy(1, won), 1); // never free
});

test('generous: pay 20% over or take 20% under, on top of the price shown', () => {
  assert.equal(generousBuy(S, 50), 60);
  assert.equal(generousSell(S, 50), 40);
  const adj = shopAdjust(S, { keeperId: 'k', s: who({ haggle: 'won' }) }, true);
  assert.equal(adj.buy(100), 108); // 90 shown, 20% over
  assert.equal(adj.sell(70), 61); // 77 shown, 20% under
});

test('generosity earns favor below tier 2; from tier 2 on it makes a pushover', () => {
  assert.equal(generousOutcome(S, who()), 'favor');
  assert.equal(generousOutcome(S, who({ favor: 23 })), 'favor');
  assert.equal(generousOutcome(S, who({ favor: 24 })), 'pushover');
});

test('fame: full in the deed town, halved per hex, none past two hexes', () => {
  const towns = [{ ref: 'here', q: 0, r: 0 }, { ref: 'near', q: 1, r: 0 }, { ref: 'two', q: 1, r: 1 }, { ref: 'far', q: 3, r: 0 }];
  assert.deepEqual(fameShares(S, { q: 0, r: 0 }, towns, 20), [
    { ref: 'here', amount: 20 }, { ref: 'near', amount: 10 }, { ref: 'two', amount: 5 },
  ]);
});
