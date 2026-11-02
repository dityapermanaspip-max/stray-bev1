import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProgress } from '../../server/battle/factory.ts';
import { buildBalance } from '../../server/config/balance.ts';
import { addItem, emptyInventory, stackKey, type Inventory } from '../../server/inventory/bag.ts';
import { equipGear, equipped, unequipGear, type GearChange } from '../../server/inventory/gear.ts';
import { cfg, RAW_CONFIG, stats } from '../fixtures/battle_data.ts';
import { catalog } from '../fixtures/items.ts';

const ANYWHERE = buildBalance(new Map([...RAW_CONFIG, ['loadout_swap_anywhere', true]]));
const TOWN = { inTown: true, inBattle: false };

function setup(items: string[]) {
  const inv = emptyInventory();
  let n = 0;
  for (const item of items) addItem(catalog, inv, item, 1, () => `${item}#${++n}`);
  return { inv, progress: createProgress(stats(), [{ name: 'punch', level: 1 }]) };
}
const pieceOf = (inv: Inventory, item: string, nth = 0) => ({ piece: inv.pieces.filter((p) => p.item === item)[nth].id });
const slotsOf = (inv: Inventory) => Object.fromEntries([...equipped(inv)].map(([slot, held]) => [slot, held.item]));

test('swaps follow the loadout rule: never in battle, town only unless the flag is on', () => {
  const { inv, progress } = setup(['iron_sword']);
  assert.equal(equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_sword'), { inTown: true, inBattle: true }), 'in_battle');
  assert.equal(equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_sword'), { inTown: false, inBattle: false }), 'not_in_town');
  assert.equal(typeof equipGear(ANYWHERE, catalog, inv, progress, pieceOf(inv, 'iron_sword'), { inTown: false, inBattle: false }), 'object');
});

test('the first equip of a weapon teaches its basic move once, unequipped from the move loadout', () => {
  const { inv, progress } = setup(['iron_sword', 'iron_sword']);
  const first = equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_sword'), TOWN) as GearChange;
  assert.equal(first.learned, 'sword_slash');
  assert.equal(first.kind, 'wield');
  assert.deepEqual(progress.moves.get('sword_slash'), { level: 1, exp: 0 });
  const second = equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_sword', 1), TOWN, 'off_hand', true) as GearChange;
  assert.equal(second.learned, null);
  assert.ok(inv.known.has('iron_sword'));
});

test('a two-handed weapon takes the main hand and clears the off hand; an off-hand item clears it back', () => {
  const { inv, progress } = setup(['iron_sword', 'iron_hammer', 'river_stone']);
  equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_sword'), TOWN, 'off_hand');
  assert.equal(equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_hammer'), TOWN, 'off_hand'), 'bad_slot');
  const hammer = equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_hammer'), TOWN) as GearChange;
  assert.deepEqual(hammer.freed.map((f) => f.item), ['iron_sword']);
  assert.deepEqual(slotsOf(inv), { main_hand: 'iron_hammer' });
  equipGear(cfg, catalog, inv, progress, { stack: stackKey('river_stone', 'improvised') }, TOWN, 'off_hand');
  assert.deepEqual(slotsOf(inv), { off_hand: 'river_stone' });
});

test('armor goes only to its slot; rings fill free fingers, then replace the first', () => {
  const rings = Array(11).fill('copper_ring');
  const { inv, progress } = setup(['iron_body', 'blanket', ...rings]);
  assert.equal(equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_body'), TOWN, 'head'), 'bad_slot');
  assert.equal(equipGear(cfg, catalog, inv, progress, { stack: stackKey('blanket', 'common') }, TOWN), 'not_wearable');
  const body = equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_body'), TOWN) as GearChange;
  assert.equal(body.kind, 'wear');
  for (let i = 0; i < 10; i++) equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'copper_ring', i), TOWN);
  assert.equal([...equipped(inv).keys()].filter((s) => s.startsWith('ring_')).length, 10);
  const eleventh = equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'copper_ring', 10), TOWN) as GearChange;
  assert.equal(eleventh.kind, 'adorn');
  assert.equal(eleventh.freed.length, 1);
  assert.equal(inv.pieces.find((p) => p.slot === 'ring_1')!.id, pieceOf(inv, 'copper_ring', 10).piece);
});

test('moving a piece to another slot leaves the old slot empty; unequip returns it to the bag', () => {
  const { inv, progress } = setup(['iron_sword']);
  equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_sword'), TOWN);
  equipGear(cfg, catalog, inv, progress, pieceOf(inv, 'iron_sword'), TOWN, 'off_hand');
  assert.deepEqual(slotsOf(inv), { off_hand: 'iron_sword' });
  assert.equal(unequipGear(cfg, inv, 'main_hand', TOWN), 'not_held');
  assert.equal(unequipGear(cfg, inv, 'tail', TOWN), 'bad_slot');
  assert.equal((unequipGear(cfg, inv, 'off_hand', TOWN) as GearChange).kind, 'wield');
  assert.deepEqual(slotsOf(inv), {});
});
