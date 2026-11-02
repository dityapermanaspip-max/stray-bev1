import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProgress } from '../../server/battle/factory.ts';
import { addItem, emptyInventory, type Inventory } from '../../server/inventory/bag.ts';
import { buildCombatGear } from '../../server/inventory/combat_gear.ts';
import { equipGear, equipped, type GearChange } from '../../server/inventory/gear.ts';
import { cfg, stats } from '../fixtures/battle_data.ts';
import { catalog } from '../fixtures/items.ts';

const TOWN = { inTown: true, inBattle: false };

function setup(items: string[]) {
  const inv = emptyInventory();
  let n = 0;
  for (const item of items) addItem(catalog, inv, item, 1, () => `${item}#${++n}`);
  return { inv, progress: createProgress(stats(), []) };
}
const pieceOf = (inv: Inventory, item: string, nth = 0) => ({ piece: inv.pieces.filter((p) => p.item === item)[nth].id });
const slotsOf = (inv: Inventory) => Object.fromEntries([...equipped(inv)].map(([slot, held]) => [slot, held.item]));

test('without dual wield a second weapon is refused in the off hand, or takes the main hand', () => {
  const { inv, progress } = setup(['iron_sword', 'iron_knife']);
  equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_sword'), TOWN);
  assert.equal(equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_knife'), TOWN, 'off_hand'), 'no_dual_wield');
  const knife = equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_knife'), TOWN) as GearChange;
  assert.deepEqual(knife.freed.map((f) => f.item), ['iron_sword']);
  assert.deepEqual(slotsOf(inv), { main_hand: 'iron_knife' });
  assert.equal(progress.moves.has('twin_stab'), false);
});

test('a lone off-hand weapon comes off when a main-hand weapon goes on, without dual wield', () => {
  const { inv, progress } = setup(['iron_sword', 'iron_knife']);
  equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_knife'), TOWN, 'off_hand');
  equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_sword'), TOWN, 'main_hand');
  assert.deepEqual(slotsOf(inv), { main_hand: 'iron_sword' });
});

test('anyone holds a shield in the off hand beside a weapon, never in the main hand', () => {
  const { inv, progress } = setup(['iron_sword', 'buckler']);
  equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_sword'), TOWN);
  assert.equal(equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'buckler'), TOWN, 'main_hand'), 'bad_slot');
  equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'buckler'), TOWN);
  assert.deepEqual(slotsOf(inv), { main_hand: 'iron_sword', off_hand: 'buckler' });
  const gear = buildCombatGear(cfg, catalog, inv);
  assert.equal(gear.weaponType, 'sword');
  assert.equal(gear.offHandType, 'shield');
});

test('a dual wielder holds two weapons; a second knife teaches Twin Stab, whichever hand goes on last', () => {
  const { inv, progress } = setup(['iron_knife', 'iron_sword']);
  equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_knife'), TOWN, 'off_hand', true);
  assert.equal(progress.moves.has('twin_stab'), false); // a lone knife is just a knife
  const sword = equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_sword'), TOWN, 'main_hand', true) as GearChange;
  assert.equal(sword.learned, 'twin_stab');
  assert.deepEqual(slotsOf(inv), { main_hand: 'iron_sword', off_hand: 'iron_knife' });
  const gear = buildCombatGear(cfg, catalog, inv);
  assert.deepEqual([gear.weaponType, gear.weapon!.power, gear.offHandType, gear.offHand!.power], ['sword', 7, 'knife', 4]);
});

test('a two-handed weapon still takes both hands for a dual wielder', () => {
  const { inv, progress } = setup(['iron_sword', 'iron_knife', 'iron_hammer']);
  equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_sword'), TOWN, 'main_hand', true);
  equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_knife'), TOWN, 'off_hand', true);
  equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_hammer'), TOWN, null, true);
  assert.deepEqual(slotsOf(inv), { main_hand: 'iron_hammer' });
});

test('tonfa are a pair held in both hands: only a dual wielder can take them up', () => {
  const { inv, progress } = setup(['tonfa', 'iron_knife']);
  assert.equal(equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'tonfa'), TOWN), 'no_dual_wield');
  equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_knife'), TOWN, null, true);
  const tonfa = equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'tonfa'), TOWN, null, true) as GearChange;
  assert.deepEqual(slotsOf(inv), { main_hand: 'tonfa' });
  assert.equal(tonfa.learned, 'tonfa_strike');
});
