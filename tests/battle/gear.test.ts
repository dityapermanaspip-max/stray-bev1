import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BattleCore } from '../../server/battle/core.ts';
import { growthRates } from '../../server/battle/damage.ts';
import { spendThrown } from '../../server/battle/effects/gear_hooks.ts';
import type { UseContext } from '../../server/battle/effects/hit.ts';
import { HANDLERS } from '../../server/battle/effects/registry.ts';
import type { BattleEntity, EffectDef, MoveDef } from '../../server/battle/types.ts';
import { addItem, countOf, emptyInventory, stackKey, type Inventory } from '../../server/inventory/bag.ts';
import { applyBattleWear, buildCombatGear } from '../../server/inventory/combat_gear.ts';
import { equipGear } from '../../server/inventory/gear.ts';
import { parseItem, type ItemCatalog } from '../../server/inventory/items.ts';
import { createProgress } from '../../server/battle/factory.ts';
import { createRng } from '../../server/util/rng.ts';
import { battleData, cfg, fighter, MOVES, move, stats } from '../fixtures/battle_data.ts';
import { catalog as baseCatalog } from '../fixtures/items.ts';

const fx = (handler: string, power: number, params: Record<string, unknown> = {}, durationTurns: number | null = null): EffectDef =>
  ({ handler, power, durationTurns, chance: 1, params });
const weaponMove = (name: string, power: number, type: string, extra: Partial<MoveDef> = {}) => move({
  name, effects: [fx('damage', power, { accuracy: 1 })],
  requires: [{ kind: 'weapon_type', value: type, amount: null }, { kind: 'body_part', value: 'hands', amount: null }],
  ...extra,
});
const EXTRA = [
  weaponMove('slash', 9, 'sword'),
  weaponMove('smash', 14, 'hammer'),
  weaponMove('throw', 5, 'thrown', { tags: ['growth.quick', 'ranged'] }),
  move({ name: 'jab', tags: ['growth.quick', 'punch'], effects: [fx('damage', 10, { accuracy: 1 })] }),
  move({ name: 'zap', damageKind: 'magic', damageType: 'force', effects: [fx('damage', 10, { accuracy: 1 })] }),
];
const data = { ...battleData(), moves: new Map([...MOVES, ...EXTRA.map((m) => [m.name, m] as const)]) };

const catalog: ItemCatalog = new Map([
  ...baseCatalog,
  ['wraps', parseItem('wraps', 'armor', 'gloves', null, { max_durability: 10, worn: { slot: 'hands', punch_power: 2 } })],
  ['dodge_ring', parseItem('dodge_ring', 'accessory', 'ring', null, { max_durability: 10, worn: { slot: 'ring' } },
    [{ trigger: 'worn', effect: fx('buff', 0, { stat: 'dodgeChance', add: 0.02 }) }])],
  ['thorn_vest', parseItem('thorn_vest', 'armor', 'cuirass', null, { max_durability: 10, worn: { slot: 'body' } },
    [{ trigger: 'on_struck', effect: fx('damage', 3, { accuracy: 9, damage_type: 'pierce' }) }])],
]);

// Sure hits: high accuracy, no luck (no crit, no dodge). str 5 = stat mult 1.
const sure = stats({ dex: 30, int: 30, luck: 0 });
const plain = stats({ luck: 0 });

function wearing(items: string[], qty = 1): Inventory {
  const inv = emptyInventory();
  const progress = createProgress(plain, []);
  let n = 0;
  for (const item of items) {
    addItem(catalog, inv, item, qty, () => `${item}#${++n}`);
    const def = catalog.get(item)!;
    const ref = def.stack ? { stack: stackKey(item, def.defaultQuality) } : { piece: inv.pieces[inv.pieces.length - 1].id };
    const done = equipGear(cfg, catalog, inv, progress, ref, { inTown: true, inBattle: false });
    assert.equal(typeof done, 'object', `equip ${item}`);
  }
  return inv;
}
const armed = (id: string, side: 'party' | 'enemy', items: string[], s = sure, qty = 1) =>
  fighter(id, side, { stats: s, gear: buildCombatGear(cfg, catalog, wearing(items, qty)) });
const IRON_SET = ['iron_head', 'iron_body', 'iron_hands', 'iron_pants', 'iron_feet'];

function hit(actor: BattleEntity, target: BattleEntity, name: string, seed = 1): number {
  const core = new BattleCore(data, [actor, target], createRng(seed), new Map(), new Set());
  const m = data.moves.get(name)!;
  const ctx: UseContext = { core, actor, move: m, level: 1, rates: growthRates(cfg, m), channelTurns: null };
  const before = target.hp;
  m.effects.forEach((f) => HANDLERS[f.handler](ctx, target, f));
  return before - target.hp;
}

test('a held weapon adds its power to moves of its type only', () => {
  const p = armed('p', 'party', ['iron_sword']);
  assert.equal(p.weaponType, 'sword');
  assert.equal(hit(p, fighter('e', 'enemy', { stats: plain }), 'slash'), 16); // 9 + 7
  assert.equal(hit(p, fighter('e', 'enemy', { stats: plain }), 'punch'), 10); // bare-hand move, no sword power
});

test('a full iron set cuts physical hits by about a quarter, not magic', () => {
  const p = armed('p', 'party', ['iron_sword']);
  assert.equal(hit(p, armed('e', 'enemy', IRON_SET, plain), 'slash'), 12); // 16 x (1 - 7/27) = 11.9
  const bare = hit(p, fighter('e', 'enemy', { stats: plain }), 'zap'); // magic scales with int
  assert.equal(hit(p, armed('e', 'enemy', IRON_SET, plain), 'zap'), bare);
});

test('the hammer gets +10% against full metal armor, scaled by coverage', () => {
  const p = armed('p', 'party', ['iron_hammer']);
  assert.equal(hit(p, armed('e', 'enemy', IRON_SET, plain), 'smash'), 19); // 23 x 1.1 x 20/27 = 18.7
  assert.equal(hit(p, armed('e', 'enemy', ['leather_body'], plain), 'smash'), 22); // no metal: 23 x 0.95
});

test('gloves add to punch moves, wear lowers what gear gives', () => {
  assert.equal(hit(armed('p', 'party', ['wraps']), fighter('e', 'enemy', { stats: plain }), 'jab'), 12);
  const inv = wearing(['iron_sword']);
  inv.pieces[0].durability = 60; // half worn: 0.5 + 0.5 x 0.5 = 0.75
  assert.equal(buildCombatGear(cfg, catalog, inv).weapon!.power, 5.25);
  inv.pieces[0].durability = 0;
  assert.equal(buildCombatGear(cfg, catalog, inv).weapon!.power, 0);
});

test('worn effects stack with falloff: ten small dodge rings give about two rings', () => {
  const p = armed('p', 'party', Array(10).fill('dodge_ring'));
  assert.ok(Math.abs((p.gear.statAdd.dodgeChance ?? 0) - 0.04) < 0.001);
  const core = new BattleCore(data, [p], createRng(1), new Map(), new Set());
  assert.ok(Math.abs(core.stat(p, 'dodgeChance') - (p.derived.dodgeChance + p.gear.statAdd.dodgeChance!)) < 1e-9);
});

test('an on-struck item effect hits the attacker back once, without ping-pong', () => {
  const p = armed('p', 'party', ['thorn_vest'], sure);
  const e = armed('e', 'enemy', ['thorn_vest'], sure);
  const full = p.hp;
  assert.equal(hit(p, e, 'punch'), 10);
  assert.equal(full - p.hp, 3); // e's vest answered; p's vest did not answer the vest
});

test('hits wear the weapon used and one armor piece; wear is written back after the fight', () => {
  const inv = wearing(['iron_sword']);
  const p = fighter('p', 'party', { stats: sure, gear: buildCombatGear(cfg, catalog, inv) });
  const e = armed('e', 'enemy', IRON_SET, plain);
  hit(p, e, 'slash');
  hit(p, e, 'slash', 2);
  assert.equal(p.gear.wear.get(inv.pieces[0].id), 2);
  assert.equal([...e.gear.wear.values()].reduce((a, b) => a + b, 0), 2);
  applyBattleWear(cfg, inv, p.gear, true, 0, createRng(1));
  assert.equal(inv.pieces[0].durability, 118);
});

test('throws spend the readied stack; an empty hand cannot throw; some come back after a win', () => {
  const inv = wearing(['river_stone'], 3);
  const p = fighter('p', 'party', { stats: sure, gear: buildCombatGear(cfg, catalog, inv) });
  const thr = data.moves.get('throw')!;
  for (let i = 0; i < 3; i++) spendThrown(p, thr);
  assert.equal(p.weaponType, null);
  assert.equal(p.gear.thrownSpent, 3);
  const lost = emptyInventory();
  addItem(catalog, lost, 'river_stone', 3);
  applyBattleWear(cfg, lost, { ...p.gear }, false, 0, createRng(1));
  assert.equal(countOf(lost, 'river_stone'), 0); // a lost fight keeps none
  const won = applyBattleWear(cfg, inv, p.gear, true, 0, () => 0.1); // every roll under 500 per mille
  assert.equal(won.thrownBack, 3);
  assert.equal(countOf(inv, 'river_stone'), 3);
  // roll 520: misses 500, but the thrower's luck 30 makes it 530
  assert.equal(applyBattleWear(cfg, emptyInventory(), { ...p.gear }, true, 0, () => 0.52).thrownBack, 0);
  assert.equal(applyBattleWear(cfg, emptyInventory(), { ...p.gear }, true, 30, () => 0.52).thrownBack, 3);
});
