import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyTraits, findTraitProblems, hasTraitFlag, rollEntityTraits, rollTraits, traitElements, type TraitOption, type TraitRules,
} from '../../server/growth/traits.ts';
import { createRng } from '../../server/util/rng.ts';
import { fighter } from '../fixtures/battle_data.ts';

const opt = (name: string, cost: number, weight = 1, modifiers: Record<string, unknown> = {}): TraitOption => ({ name, cost, weight, modifiers });
const ELEMENT = { group: 'element', affinity: 100 };
const OPTIONS = [
  opt('dual_wielder', 80, 1, { dual_wield: true }),
  opt('elemental_affinity', 90, 4, { ...ELEMENT, elements: 1 }),
  opt('dual_element', 200, 2, { ...ELEMENT, elements: 2 }),
  opt('triple_element', 280, 1, { ...ELEMENT, elements: 3 }),
  opt('element_ward', 45, 5, { resist_random_element: 0.5 }),
  opt('iron_gut', 25, 8, { resist: { 'status:poison': 0.5 } }),
  opt('keen_eyes', 40, 6, { stat_add: { critChance: 0.05 } }),
  opt('scavenger', 20, 8),
  opt('berserker', 0, 0),
];
const WINDOW = { minShare: 0.35, maxShare: 1 };
const RULES: TraitRules = { quota: { min: 10, max: 300 }, window: WINDOW, elements: ['fire', 'water', 'ice', 'earth', 'wind', 'lightning', 'holy', 'dark'] };
const names = (picked: TraitOption[]) => picked.map((p) => p.name);

test('every pick costs 35%-100% of the quota left; nothing in the window is left over', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rng = createRng(seed);
    const quota = 10 + Math.floor(rng() * 291);
    let left = quota;
    const picked = rollTraits(rng, quota, OPTIONS, WINDOW);
    for (const p of picked) {
      assert.ok(p.cost >= 0.35 * left && p.cost <= left, `seed ${seed}: ${p.name} at ${left}`);
      left -= p.cost;
    }
    const groups = new Set(picked.map((p) => p.modifiers.group).filter(Boolean));
    const open = OPTIONS.filter((o) => o.weight > 0 && !picked.includes(o) && !groups.has(o.modifiers.group)
      && o.cost >= 0.35 * left && o.cost <= left);
    assert.deepEqual(open, [], `seed ${seed}: window not empty`);
  }
});

test('a big quota is never spent on filler: 300 with the first pick always taken', () => {
  const first = () => 0;
  assert.deepEqual(names(rollTraits(first, 300, OPTIONS, WINDOW)), ['dual_element', 'dual_wielder', 'scavenger']); // 300 -> 100 -> 20 -> 0
  assert.deepEqual(names(rollTraits(first, 100, OPTIONS, WINDOW)), ['dual_wielder', 'scavenger']); // 100 -> 20
  assert.deepEqual(names(rollTraits(first, 10, OPTIONS, WINDOW)), []);
});

test('only one element trait, and weight 0 traits are never rolled', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const picked = names(rollTraits(createRng(seed), 300, OPTIONS, WINDOW));
    assert.ok(picked.filter((n) => n.endsWith('_element') || n === 'elemental_affinity').length <= 1);
    assert.ok(!picked.includes('berserker'));
  }
});

test('element traits roll that many different elements; a ward rolls one element to resist', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 200; seed++) {
    for (const t of rollEntityTraits(createRng(seed), RULES, OPTIONS)) {
      const n = Number(t.modifiers.elements ?? 0);
      if (n > 0) {
        const els = t.params.elements as string[];
        assert.equal(new Set(els).size, n);
        els.forEach((e) => seen.add(e));
      }
      if (t.name === 'element_ward') assert.ok(RULES.elements.includes(t.params.element as string));
    }
  }
  assert.equal(seen.size, RULES.elements.length);
});

test('traits put their resistances and stat additions on the fighter', () => {
  const e = fighter('p', 'party');
  const before = e.gear.statAdd.critChance ?? 0;
  applyTraits(e, [
    { name: 'iron_gut', modifiers: { resist: { 'status:poison': 0.5 } }, params: {} },
    { name: 'element_ward', modifiers: { resist_random_element: 0.5 }, params: { element: 'ice' } },
    { name: 'keen_eyes', modifiers: { stat_add: { critChance: 0.05 } }, params: {} },
  ]);
  assert.equal(e.resist.get('status:poison'), 0.5);
  assert.equal(e.resist.get('element:ice'), 0.5);
  assert.ok(Math.abs((e.gear.statAdd.critChance ?? 0) - before - 0.05) < 1e-9);
  assert.deepEqual(traitElements([{ name: 'dual_element', modifiers: { elements: 2 }, params: { elements: ['holy', 'lightning'] } }]), ['holy', 'lightning']);
});

test('code reads modifier flags, not trait names; the check wants lines and known keys', () => {
  assert.ok(hasTraitFlag([{ name: 'anything', modifiers: { dual_wield: true }, params: {} }], 'dual_wield'));
  assert.ok(!hasTraitFlag([{ name: 'dual_wielder', modifiers: {}, params: {} }], 'dual_wield'));
  const lines = new Set(['trait_name_keen_eyes', 'trait_flavor_keen_eyes']);
  assert.deepEqual(findTraitProblems([opt('keen_eyes', 40, 6, { stat_add: { critChance: 0.05 } })], lines, RULES.elements), []);
  assert.equal(findTraitProblems([opt('odd', 1, 1, { stat_add: { maxHp: 5 }, resist: { poison: 0.5 } })], lines, []).length, 5);
});
