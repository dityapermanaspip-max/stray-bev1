import assert from 'node:assert/strict';
import { test } from 'node:test';
import { strayTargets, validTargets } from '../../server/battle/rules.ts';
import { addItem, emptyInventory } from '../../server/inventory/bag.ts';
import { applyBattleWear, buildCombatGear } from '../../server/inventory/combat_gear.ts';
import { cfg, fighter, move } from '../fixtures/battle_data.ts';
import { catalog } from '../fixtures/items.ts';

const spear = move({ name: 'spear_thrust', rowRule: 'reach', effects: [{ handler: 'damage', power: 5, durationTurns: null, chance: 1, params: {} }] });

test('a reach move reaches both enemy rows from either row', () => {
  const me = fighter('me', 'party', { slot: 5 });
  const ally = fighter('ally', 'party', { slot: 1 });
  const all = [me, ally, fighter('front', 'enemy', { slot: 1 }), fighter('back', 'enemy', { slot: 6 })];
  assert.deepEqual(validTargets(all, me, spear).map((e) => e.id), ['front', 'back']);
  assert.deepEqual(validTargets(all, ally, spear).map((e) => e.id), ['front', 'back']);
});

test('from behind a living front row a reach move may strike the ally in front; from the front it never strays', () => {
  const me = fighter('me', 'party', { slot: 5 });
  const ally = fighter('ally', 'party', { slot: 1 });
  const foe = fighter('foe', 'enemy', { slot: 1 });
  const all = [me, ally, foe];
  const chance = cfg.combat.reachStrayChance;
  assert.deepEqual(strayTargets(cfg, () => chance - 0.01, all, me, spear, [foe]).map((e) => e.id), ['ally']);
  assert.deepEqual(strayTargets(cfg, () => chance + 0.01, all, me, spear, [foe]).map((e) => e.id), ['foe']);
  assert.deepEqual(strayTargets(cfg, () => 0, all, ally, spear, [foe]).map((e) => e.id), ['foe']);
});

test('arrows in the bag are battle ammo; fired ones are gone unless picked up after a win', () => {
  const inv = emptyInventory();
  addItem(catalog, inv, 'arrow', 5);
  const p = fighter('p', 'party', { gear: buildCombatGear(cfg, catalog, inv) });
  assert.equal(p.ammo.get('arrow'), 5);
  p.gear.ammoSpent.set('arrow', 3);
  const lost = applyBattleWear(cfg, inv, p.gear, false, 0, () => 0);
  assert.equal(lost.thrownBack, 0);
  assert.equal([...inv.stacks.values()].find((s) => s.item === 'arrow')?.qty, 2);
  const again = emptyInventory();
  addItem(catalog, again, 'arrow', 5);
  assert.equal(applyBattleWear(cfg, again, p.gear, true, 0, () => 0.1).thrownBack, 3);
  assert.equal([...again.stacks.values()].find((s) => s.item === 'arrow')?.qty, 5);
});
