import assert from 'node:assert/strict';
import { test } from 'node:test';
import { usableMoves } from '../../server/battle/ai.ts';
import { BattleCore } from '../../server/battle/core.ts';
import { growthRates, luckRange } from '../../server/battle/damage.ts';
import type { UseContext } from '../../server/battle/effects/hit.ts';
import { HANDLERS } from '../../server/battle/effects/registry.ts';
import { createProgress } from '../../server/battle/factory.ts';
import type { BattleEntity, EffectDef, MoveDef } from '../../server/battle/types.ts';
import { createRng } from '../../server/util/rng.ts';
import { battleData, cfg, fighter, MOVES, move, stats } from '../fixtures/battle_data.ts';

const fx = (handler: string, power: number, durationTurns: number | null, params: Record<string, unknown> = {}): EffectDef =>
  ({ handler, power, durationTurns, chance: 1, params });

const EXTRA: MoveDef[] = [
  move({ name: 'grab', category: 'control', damageType: null, gives: [], brokenBy: ['damage'], effects: [fx('bind', 0, 2)] }),
  move({ name: 'gut', effects: [fx('damage', 8, null), fx('drain', 0, null, { share: 0.1 })] }),
  move({ name: 'nerve', category: 'control', effects: [fx('disable_part', 0, 2, { part: 'hands' })] }),
  move({ name: 'soft_palm', category: 'guard', target: 'self', effects: [fx('guard', 0.6, 3, { hits: 1 })] }),
  move({ name: 'esquiva', category: 'guard', target: 'self', effects: [fx('buff', 0, 3, { stat: 'dodgeChance', add: 0.5, pays_on: 'dodge' })] }),
  move({ name: 'knee', effects: [fx('damage', 13, null, { bonus_vs_effect: 'bind', bonus_mult: 1.5 })] }),
  move({ name: 'au', effects: [fx('damage', 6, null), fx('buff', 0, 1, { stat: 'dodgeChance', add: 0.15, self: true })] }),
];
const data = { ...battleData(), moves: new Map([...MOVES, ...EXTRA.map((m) => [m.name, m] as const)]) };

// Sure hits: high accuracy, no luck (no crit, no dodge).
const sure = stats({ dex: 30, int: 30, luck: 0 });

function setup(entities: BattleEntity[], seed = 1) {
  const progress = new Map(entities.filter((e) => e.grows).map((e) => [e.id, createProgress(e.stats, [...e.moveLevels].map(([name, level]) => ({ name, level })))]));
  return new BattleCore(data, entities, createRng(seed), progress, new Set());
}

function use(core: BattleCore, actor: BattleEntity, target: BattleEntity, name: string) {
  const m = data.moves.get(name)!;
  const ctx: UseContext = { core, actor, move: m, level: 1, rates: growthRates(cfg, m), channelTurns: null };
  return m.effects.map((f) => HANDLERS[f.handler](ctx, target, f));
}

test('bind blocks every move of the target until the hold breaks', () => {
  const p = fighter('p', 'party', { stats: sure, moves: [{ name: 'grab', level: 1 }] });
  const e = fighter('e', 'enemy', { stats: stats({ luck: 0 }) });
  const core = setup([p, e]);
  use(core, p, e, 'grab');
  assert.ok(core.isBound(e));
  assert.deepEqual(usableMoves(core, e), []);
  core.interrupt(p, ['damage']); // someone hits the holder
  assert.ok(!core.isBound(e));
  assert.ok(core.events.some((x) => x.type === 'status' && x.status === 'bind' && x.phase === 'end'));
  assert.equal(usableMoves(core, e).length, 1);
});

test('drain removes a share of the target max stamina', () => {
  const p = fighter('p', 'party', { stats: sure });
  const e = fighter('e', 'enemy', { stats: stats({ luck: 0 }) });
  const core = setup([p, e]);
  use(core, p, e, 'gut');
  assert.equal(e.stamina, e.derived.maxStamina * 0.9);
});

test('disable_part stops moves that need that part', () => {
  const p = fighter('p', 'party', { stats: sure });
  const e = fighter('e', 'enemy', { stats: stats({ luck: 0 }) });
  const core = setup([p, e]);
  assert.equal(usableMoves(core, e).length, 1);
  use(core, p, e, 'nerve');
  assert.deepEqual(usableMoves(core, e), []);
});

test('a one-hit guard cuts the next hit and then ends', () => {
  const p = fighter('p', 'party', { stats: sure });
  const e = fighter('e', 'enemy', { stats: stats({ luck: 0 }) });
  const core = setup([p, e]);
  use(core, e, e, 'soft_palm');
  use(core, p, e, 'punch');
  assert.equal(core.find(e, 'guard'), undefined);
  const [first, second] = core.events.filter((x) => x.type === 'damage').map((x) => (x.type === 'damage' ? x.amount : 0));
  use(core, p, e, 'punch');
  const third = core.events.filter((x) => x.type === 'damage').map((x) => (x.type === 'damage' ? x.amount : 0))[1];
  assert.equal(second, undefined);
  assert.ok(first < third, 'the guarded hit was smaller');
});

test('an evade buff pays exp only when its owner dodges', () => {
  const p = fighter('p', 'enemy', { stats: sure, grows: false });
  const e = fighter('e', 'party', { stats: stats({ luck: 0 }), moves: [{ name: 'esquiva', level: 1 }] });
  const core = setup([e, p], 3);
  use(core, e, e, 'esquiva');
  const exp = () => core.progress.get('e')!.moves.get('esquiva')!.exp;
  assert.equal(exp(), 0);
  for (let i = 0; i < 20 && exp() === 0; i++) use(core, p, e, 'punch');
  assert.ok(exp() > 0);
  assert.ok(core.events.some((x) => x.type === 'miss'));
});

test('knee strike hits harder against a bound target', () => {
  const run = (bound: boolean) => {
    const p = fighter('p', 'party', { stats: sure });
    const e = fighter('e', 'enemy', { stats: stats({ luck: 0, end: 40 }) });
    const core = setup([p, e], 9);
    if (bound) e.effects.push({ kind: 'bind', byId: 'p', remaining: 2 });
    use(core, p, e, 'knee');
    const hit = core.events.find((x) => x.type === 'damage');
    return hit?.type === 'damage' ? hit.amount : 0;
  };
  assert.ok(Math.abs(run(true) / run(false) - 1.5) < 0.1);
});

test('a self buff on an attack lands on the user', () => {
  const p = fighter('p', 'party', { stats: sure });
  const e = fighter('e', 'enemy', { stats: stats({ luck: 0 }) });
  const core = setup([p, e]);
  use(core, p, e, 'au');
  assert.ok(core.find(p, 'buff'));
  assert.equal(core.find(e, 'buff'), undefined);
});

test('luck pulls a random range toward the top but never past it', () => {
  assert.equal(luckRange([0.4, 1.9], 0, 50, 0.05), 0.4);
  assert.equal(luckRange([0.4, 1.9], 1, 50, 0.05), 1.9);
  assert.ok(luckRange([0.4, 1.9], 0.5, 20, 0.05)! > luckRange([0.4, 1.9], 0.5, 1, 0.05)!);
  assert.equal(luckRange(undefined, 0.5, 5, 0.05), null);
});
