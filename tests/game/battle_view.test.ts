import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProgress } from '../../server/battle/factory.ts';
import { BattleInstance } from '../../server/battle/instance.ts';
import type { BattleEvent } from '../../server/battle/types.ts';
import { killsOf } from '../../server/game/battle/battle_end.ts';
import type { Fight } from '../../server/game/battle/battle_setup.ts';
import { battleView, eventsFor, type Words } from '../../server/game/battle/battle_view.ts';
import { LinePicker } from '../../server/presentation/line_picker.ts';
import { createRng } from '../../server/util/rng.ts';
import { battleData, fighter, MOVES, stats } from '../fixtures/battle_data.ts';

const row = (condition_key: string, tier: number, text: string) =>
  ({ condition_key, tier, speaker: 'generic', personality_tag: null, expression: 'neutral', text, locale: 'en' });
const words: Words = {
  lines: new LinePicker([
    row('species_name_cat', 0, 'Cat'), row('move_name_punch', 0, 'Punch'),
    ...[1, 2, 3, 4, 5].flatMap((t) => ['hp', 'stamina', 'mana'].map((r) => row(`body_word.${r}`, t, `${r}${t}`))),
  ]),
  rng: createRng(1),
  moves: MOVES,
};

function fight(companions: Fight['companions'] = []): Fight {
  const player = fighter('me', 'party');
  const foes = [fighter('cat_1', 'enemy'), fighter('cat_2', 'enemy', { corrupted: false })];
  const progress = createProgress(player.stats, [{ name: 'punch', level: 1 }]);
  const instance = new BattleInstance(battleData(), {
    entities: [player, ...companions.map((c) => c.entity), ...foes],
    progress: new Map([['me', progress]]), summonerSides: new Set(), seed: 1,
  });
  return {
    order: { entityId: 'me', name: 'walker1', fieldRef: 'f', x: 0, y: 0, seed: 1, foes: [{ species: 'cat', corrupted: true }, { species: 'cat', corrupted: false }] },
    instance, player, foes, companions, summonerWith: false, vices: new Map(), ground: { biome: 'meadow', terrain: 'grass' },
    state: { id: 'me', kind: 'player', name: 'walker1', bodyParts: [], progress, loadout: new Map([[1, 'punch']]), body: null, unseen: new Set(), slot: 1, traits: [], raceResist: new Map() },
    inventory: { pieces: [], stacks: [] } as unknown as Fight['inventory'],
  };
}

test('the view names fighters, shows own body words and only health for foes', () => {
  const f = fight();
  const view = battleView(words, f, 8, { front: 4, back: 3 });
  assert.equal(view.slots, 8);
  const me = view.fighters.find((x) => x.you)!;
  const foe = view.fighters.find((x) => x.id === 'cat_1')!;
  assert.equal(me.name, 'walker1');
  assert.equal(me.stamina?.text, 'stamina5');
  assert.equal(foe.name, 'Cat');
  assert.equal(foe.hp.text, 'hp5');
  assert.equal(foe.stamina, null);
  assert.deepEqual(view.moves, [{ move: 'punch', slot: 1, name: 'Punch', target: 'one_enemy', front: true }]);
  assert.deepEqual(view.formation, { front: 4, back: 3 });
  assert.ok(!JSON.stringify(view).match(/"(str|dex|atb|exp|maxHp)"/));
});

test('events hide foe stamina tiers and other fighters learning, and add words to tiers', () => {
  const f = fight();
  const raw: BattleEvent[] = [
    { type: 'tier', entity: 'cat_1', resource: 'stamina', tier: 2 },
    { type: 'tier', entity: 'cat_1', resource: 'hp', tier: 3 },
    { type: 'tier', entity: 'me', resource: 'mana', tier: 4 },
    { type: 'learned', entity: 'cat_1', move: 'punch' },
    { type: 'learned', entity: 'me', move: 'punch' },
    { type: 'status', entity: 'me', status: 'bleed', phase: 'start' },
    { type: 'end', winner: 'party' },
  ];
  assert.deepEqual(eventsFor(words, f, raw), [
    { type: 'tier', entity: 'cat_1', resource: 'hp', word: { tier: 3, text: 'hp3' } },
    { type: 'tier', entity: 'me', resource: 'mana', word: { tier: 4, text: 'mana4' } },
    { type: 'learned', move: 'punch', name: 'Punch' },
    { type: 'end', won: true },
  ]);
});

test('kills are the fallen foes, with species and corruption from the encounter', () => {
  const f = fight();
  f.foes[1].hp = 0;
  const kills = killsOf(f, 5);
  assert.equal(kills.length, 1);
  assert.equal(kills[0].species, 'cat');
  assert.equal(kills[0].corrupted, false);
  assert.equal(kills[0].killedAt, 5);
});

test('a companion shows their own name and health, not a species line', () => {
  const mate = fighter('mate_1', 'party', { kind: 'recruit', controller: 'ai', slot: 2, speaker: 'generic' });
  const f = fight([{
    entity: mate,
    state: { id: 'mate_1', kind: 'recruit', name: 'Brinn', bodyParts: [], progress: createProgress(mate.stats, []), loadout: new Map(), body: null, unseen: new Set(), slot: 2, traits: [], raceResist: new Map() },
    inventory: { pieces: [], stacks: [] } as unknown as Fight['companions'][number]['inventory'],
  }]);
  const view = battleView(words, f, 8, { front: 4, back: 3 });
  const m = view.fighters.find((x) => x.id === 'mate_1')!;
  assert.equal(m.name, 'Brinn');
  assert.equal(m.side, 'party');
  assert.equal(m.hp.text, 'hp5'); // body tier word, no numbers
  assert.equal(m.stamina, null); // an ally's gauge stays hidden
});

test('a player-controlled fighter with nothing usable passes the turn instead of waiting forever', () => {
  const me = fighter('me', 'party', { stats: stats({ dex: 30 }), moves: [] });
  const foe = fighter('e', 'enemy', { controller: 'ai', stats: stats({ str: 1 }) });
  const inst = new BattleInstance(battleData(), { entities: [me, foe], progress: new Map(), summonerSides: new Set(), seed: 1 });
  let stuck = 0;
  for (let t = 0; t < 10_000 && !inst.winner; t += 100) {
    inst.tick(100);
    if (me.phase === 'ready') stuck += 1;
  }
  assert.equal(stuck, 0);
  assert.deepEqual(inst.options('me'), []);
});
