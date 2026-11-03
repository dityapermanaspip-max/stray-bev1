import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProgress } from '../../server/battle/factory.ts';
import { addItem, emptyInventory } from '../../server/inventory/bag.ts';
import { buildBagView } from '../../server/inventory/bag_view.ts';
import { equipGear } from '../../server/inventory/gear.ts';
import { LinePicker } from '../../server/presentation/line_picker.ts';
import { createRng } from '../../server/util/rng.ts';
import { cfg, stats } from '../fixtures/battle_data.ts';
import { catalog } from '../fixtures/items.ts';

const line = (condition_key: string, tier: number, text: string) =>
  ({ condition_key, tier, speaker: 'generic', personality_tag: null, expression: 'neutral', text, locale: 'en' });
const lines = new LinePicker([
  line('load', 1, 'My pack is light.'),
  line('item_name_iron_hammer', 0, 'Iron hammer'),
  line('gear_slot_main_hand', 0, 'Main hand'),
  line('item_name_river_stone', 0, 'River stone'),
]);

test('the bag view shows names, counts, slots, load and condition tiers, and no weights or durability', () => {
  const inv = emptyInventory();
  addItem(catalog, inv, 'iron_hammer', 1, () => 'h1');
  addItem(catalog, inv, 'river_stone', 7);
  inv.pieces[0].durability = 33;
  equipGear(cfg, catalog, inv, createProgress(stats(), []), { piece: 'h1' }, { inTown: true, inBattle: false });

  const view = buildBagView(cfg, catalog, lines, createRng(1), 'generic', inv, 90);
  assert.deepEqual(view.load, { tier: 1, text: 'My pack is light.' });
  assert.equal(view.slots.find((s) => s.slot === 'main_hand')!.item, 'Iron hammer');
  assert.deepEqual(view.items.map((i) => [i.name, i.qty, i.slot, i.condition]), [
    ['Iron hammer', 1, 'main_hand', 2],
    ['River stone', 7, null, null],
  ]);
  const hand = view.slots.find((s) => s.slot === 'main_hand')!;
  assert.deepEqual([hand.label, hand.accepts], ['Main hand', 'hand']);
  assert.deepEqual(view.items.map((i) => [i.fits, i.droppable]), [['hand', true], ['hand', true]]);
  const text = JSON.stringify(view);
  for (const banned of ['33', '120', 'weight', 'durability', 'power', '6.5']) assert.ok(!text.includes(banned), `leaks ${banned}`);
});
