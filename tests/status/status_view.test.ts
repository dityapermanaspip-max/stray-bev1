import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProgress } from '../../server/battle/factory.ts';
import { starterLoadout } from '../../server/loadout/loadout.ts';
import { LinePicker } from '../../server/presentation/line_picker.ts';
import { buildStatusView } from '../../server/status/status_view.ts';
import { createRng } from '../../server/util/rng.ts';
import { cfg, stats } from '../fixtures/battle_data.ts';

const line = (condition_key: string, tier: number, text: string) =>
  ({ condition_key, tier, speaker: 'generic', personality_tag: null, expression: 'neutral', text, locale: 'en' });

const lines = new LinePicker([
  line('body.hp', 2, 'I am hurt.'),
  line('body.hp', 5, 'I feel fine.'),
  line('move_name_punch', 0, 'Punch'),
  line('move_name_kick', 0, 'Kick'),
  line('move_name_guard', 0, 'Guard'),
]);

function view(body: { hp: number; stamina: number; mana: number } | null) {
  const progress = createProgress(stats(), [{ name: 'punch', level: 7 }, { name: 'kick', level: 1 }, { name: 'guard', level: 1 }]);
  return buildStatusView({
    cfg, lines, rng: createRng(1), speaker: 'generic',
    progress, loadout: starterLoadout(cfg, ['punch', 'kick']), body, unseen: new Set(['guard']),
  });
}

test('a missing body row means full; pools show as tiers and sentences', () => {
  assert.deepEqual(view(null).body[0], { resource: 'hp', tier: 5, text: 'I feel fine.' });
  // 20 of 70 HP sits between 0.15 and 0.4.
  assert.deepEqual(view({ hp: 20, stamina: 90, mana: 75 }).body[0], { resource: 'hp', tier: 2, text: 'I am hurt.' });
});

test('moves show names, mastery tiers, slots and the new flag, equipped first', () => {
  const v = view(null);
  assert.equal(v.slots.length, cfg.loadoutSlots);
  assert.deepEqual(v.slots[0], { slot: 1, move: 'punch' });
  assert.deepEqual(v.slots[2], { slot: 3, move: null });
  assert.deepEqual(v.moves.map((m) => [m.name, m.mastery, m.slot, m.isNew]), [
    ['Punch', 2, 1, false],
    ['Kick', 1, 2, false],
    ['Guard', 1, null, true],
  ]);
});

test('the payload carries no levels, exp, stats or pool numbers', () => {
  const text = JSON.stringify(view({ hp: 20, stamina: 31, mana: 12 }));
  for (const banned of ['level', 'exp', '"str"', 'maxHp', '20', '31', '12']) {
    assert.ok(!text.includes(banned), `payload leaks ${banned}`);
  }
});
