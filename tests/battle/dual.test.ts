import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BattleCore } from '../../server/battle/core.ts';
import { growthRates } from '../../server/battle/damage.ts';
import type { UseContext } from '../../server/battle/effects/hit.ts';
import { HANDLERS } from '../../server/battle/effects/registry.ts';
import { createProgress } from '../../server/battle/factory.ts';
import { meetsRequirements } from '../../server/battle/rules.ts';
import type { BattleEntity, MoveDef, RequireDef } from '../../server/battle/types.ts';
import { addItem, emptyInventory } from '../../server/inventory/bag.ts';
import { buildCombatGear } from '../../server/inventory/combat_gear.ts';
import { equipGear } from '../../server/inventory/gear.ts';
import { createRng } from '../../server/util/rng.ts';
import { battleData, cfg, fighter, MOVES, move, stats } from '../fixtures/battle_data.ts';
import { catalog } from '../fixtures/items.ts';

// Sword (7) in the main hand, knife (4) in the off hand. Sure hits, no crits, stat mult 1.
const sure = stats({ dex: 30, int: 30, luck: 0 });
const plain = stats({ luck: 0 });
const req = (kind: string, value: string): RequireDef => ({ kind, value, amount: null });
const BOTH = [req('weapon_type', 'sword'), req('off_hand_type', 'knife')];
const strikeMove = (name: string, params: Record<string, unknown>, requires: RequireDef[]): MoveDef =>
  move({ name, effects: [{ handler: 'damage', power: 10, durationTurns: null, chance: 1, params: { accuracy: 1, ...params } }], requires });
const EXTRA = [
  strikeMove('single', {}, [req('weapon_type', 'sword')]),
  strikeMove('cross', { hands: 'sum' }, BOTH),
  strikeMove('twin', { hands: 'each', hit_count: 2 }, BOTH),
];
const data = { ...battleData(), moves: new Map([...MOVES, ...EXTRA.map((m) => [m.name, m] as const)]) };

function dualist(): BattleEntity {
  const inv = emptyInventory();
  const progress = createProgress(plain, []);
  for (const [item, slot] of [['iron_sword', 'main_hand'], ['iron_knife', 'off_hand']]) {
    addItem(catalog, inv, item, 1, () => item);
    equipGear(cfg, catalog, inv, progress, { piece: item }, { inTown: true, inBattle: false }, slot, true);
  }
  return fighter('p', 'party', { stats: sure, gear: buildCombatGear(cfg, catalog, inv) });
}

function hits(actor: BattleEntity, name: string): number[] {
  const target = fighter('e', 'enemy', { stats: plain });
  const core = new BattleCore(data, [actor, target], createRng(1), new Map(), new Set());
  const m = data.moves.get(name)!;
  const ctx: UseContext = { core, actor, move: m, level: 1, rates: growthRates(cfg, m), channelTurns: null };
  m.effects.forEach((f) => HANDLERS[f.handler](ctx, target, f));
  return core.events.flatMap((e) => (e.type === 'damage' ? [e.amount] : []));
}

test('a single-weapon move uses the main hand only, even with a second weapon held', () => {
  assert.deepEqual(hits(dualist(), 'single'), [17]); // 10 + sword 7
});

test('a sum dual move adds both weapons into one hit', () => {
  assert.deepEqual(hits(dualist(), 'cross'), [21]); // 10 + 7 + 4
});

test('an each dual move swings the hands in turn, each hit with its own weapon', () => {
  assert.deepEqual(hits(dualist(), 'twin'), [12, 9]); // 5 + 7, then 5 + 4
});

test('dual moves need the off-hand weapon type', () => {
  const lone = fighter('p', 'party', { stats: sure, gear: { ...dualist().gear, offHand: null, offHandType: null } });
  assert.equal(meetsRequirements(dualist(), data.moves.get('cross')!), true);
  assert.equal(meetsRequirements(lone, data.moves.get('cross')!), false);
});
