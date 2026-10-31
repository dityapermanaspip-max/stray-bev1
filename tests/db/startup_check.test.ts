import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findArrivalProblems,
  findBodyTierProblems,
  findItemProblems,
  findLineProblems,
  findLootProblems,
  findMoveProblems,
  findNumberProblems,
  findUnlockProblems,
  knownGrowthTags,
} from '../../server/db/startup_check.ts';
import { parseItem } from '../../server/inventory/items.ts';

const group = (condition_key: string, tier: number, count: number) => ({
  condition_key,
  tier,
  speaker: 'generic',
  count,
});

test('growth tag is known only with all three rates', () => {
  const tags = knownGrowthTags([
    'growth.heavy.damage_per_level',
    'growth.heavy.recovery_per_level',
    'growth.heavy.cost_per_level',
    'growth.quick.damage_per_level',
    'ring_count',
  ]);
  assert.deepEqual([...tags], ['heavy']);
});

test('line pools below the minimum fail, display names are exempt', () => {
  const problems = findLineProblems(
    [group('body.hp', 1, 6), group('body.hp', 2, 5), group('move_name_punch', 0, 1)],
    6,
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /body\.hp tier 2/);
});

test('every body tier needs a pool', () => {
  const problems = findBodyTierProblems({ hp: [0, 0.5] }, [group('body.hp', 1, 6)], 'generic');
  assert.deepEqual(problems, ['body.hp tier 2 (generic): no lines']);
});

test('lines with numbers fail, display names are exempt', () => {
  const problems = findNumberProblems([
    { condition_key: 'level_up.str', text: 'Strength rose to 6.' },
    { condition_key: 'move_name_punch', text: 'Punch 2' },
    { condition_key: 'body.hp', text: 'I feel fine.' },
  ]);
  assert.equal(problems.length, 1);
});

test('moves need one known growth tag and a name line', () => {
  const problems = findMoveProblems(
    [
      { move_name: 'punch', tags: ['growth.quick', 'melee'] },
      { move_name: 'kick', tags: ['growth.heavy', 'growth.quick'] },
      { move_name: 'rally', tags: ['growth.charm'] },
    ],
    new Set(['quick', 'heavy']),
    new Set(['move_name_punch', 'move_name_kick']),
  );
  assert.deepEqual(problems, [
    'kick: needs exactly one growth tag, has 2',
    'rally: unknown growth tag charm',
    'rally: missing move_name_rally line',
  ]);
});

test('arrival text needs exactly one line and every answer needs its text', () => {
  const problems = findLineProblems([group('arrival.q.where', 0, 2), group('arrival.a.where.bed', 0, 1)], 6);
  assert.equal(problems.length, 1);
  const arrival = findArrivalProblems(
    [
      { question_key: 'where', answer_key: 'bed' },
      { question_key: 'where', answer_key: 'gym' },
    ],
    new Set(['arrival.q.where', 'arrival.a.where.bed']),
    2,
  );
  assert.deepEqual(arrival, ['arrival where.gym: missing answer line']);
  assert.equal(findArrivalProblems([{ question_key: 'where', answer_key: 'bed' }], new Set(['arrival.q.where', 'arrival.a.where.bed']), 5).length, 1);
});

test('unlock rules need a known kind and an epiphany line pool', () => {
  const problems = findUnlockProblems(
    [
      { move_name: 'heavy_strike', kind: 'mastery' },
      { move_name: 'rally', kind: 'combo' },
      { move_name: 'rally', kind: 'combo' },
      { move_name: 'odd', kind: 'dream' },
    ],
    ['mastery', 'combo'],
    new Set(['epiphany_mastery']),
    'epiphany_',
  );
  assert.deepEqual(problems, ['rally: no epiphany_combo lines', 'odd: unknown unlock kind dream']);
});

test('items need a name line, a durability source, a slot that exists, and a known granted move', () => {
  const slots = [{ accepts: 'hand', kind: 'wield' }];
  const good = parseItem('club', 'weapon', 'club', null, { max_durability: 50, wield: { weapon_type: 'club', grants_move: 'club_swing' } });
  const bad = parseItem('crown', 'armor', 'crown', null, { worn: { slot: 'head', armor: true } });
  const keys = new Set(['item_name_club', 'gear.equip.wield', 'gear.unequip.wield']);
  const tiers = new Set(['load|1', 'load|2']);
  assert.deepEqual(findItemProblems([good], slots, keys, new Set(['club_swing']), 2, tiers), []);
  assert.deepEqual(findItemProblems([bad], slots, keys, new Set(), 3, tiers), [
    'crown: missing item_name_crown line',
    'crown: gear needs max_durability or a material durability',
    'crown: no gear slot accepts head',
    'crown: armor needs a core material',
    'load tier 3: no lines',
  ]);
});

test('loot needs its line pools, freshness tiers, real rots_to and coin items, and the butchery move', () => {
  const meat = parseItem('meat', 'food', 'meat', null, { rots_to: 'mush' });
  const problems = findLootProblems(
    [meat], ['butcher.paid', 'shop.bought'], new Set(['butcher.paid']), new Set(['carcass.freshness|1']),
    2, ['copper_coin'], new Set(), 'butchery',
  );
  assert.deepEqual(problems, [
    'shop.bought: no lines',
    'carcass freshness tier 2: no lines',
    'meat: rots to unknown item mush',
    'coin_values: unknown coin item copper_coin',
    'butchery: unknown move butchery',
  ]);
});
