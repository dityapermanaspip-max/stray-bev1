import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TraitOption } from '../../server/growth/traits.ts';
import type { UnlockRule } from '../../server/growth/unlocks.ts';
import { rollRecruit } from '../../server/recruit/recruit_roll.ts';
import {
  findTemplateProblems, mercenaryWage, notablesFor, parseTemplate, poolShare, poolSize, recruitConfig, recruitReady, recruitThreshold,
} from '../../server/recruit/recruit_rules.ts';
import { planRoster } from '../../server/recruit/roster.ts';
import { createRng } from '../../server/util/rng.ts';
import { cfg } from '../fixtures/battle_data.ts';

const rc = recruitConfig({
  pool_share: { outer: 0.05, step: 0.01, min: 0.01 }, budget_spread: 10,
  notables: [{ role: 'village_elder', min_population: 0 }, { role: 'chief_guard', min_population: 0 },
    { role: 'merchant', min_population: 600 }, { role: 'mayor', min_population: 1200 }],
  threshold: { base: 10, per_level: 1, lineage_mult: 2 }, inherit_share: 0.5, wage: { base: 5, per_level: 0.5 },
  summoner_from: ['village_elder', 'chief_guard'], ammo_carried: 20,
});
const STATS = { str: 6, dex: 7, int: 4, end: 6, luck: 5, charm: 3 };
const butcherson = parseTemplate('butcherson', {
  source: 'lineage', parents: ['shop', 'butcher'], stats: STATS, open: ['punch', 'knife_stab'], moves: ['slice', 'flay'],
  flag_moves: { dual_wield: ['twin_stab', 'cross_cut'] }, life: { butchery: [5, 12] },
  gear: [{ item: 'iron_knife', slot: 'main_hand' }], flag_gear: { dual_wield: [{ item: 'iron_knife', slot: 'off_hand' }] },
});
const healer = parseTemplate('apprentice_healer', { source: 'lineage', parents: ['temple'], elements: ['holy'], stats: STATS, open: ['bandage'] });
const merc = parseTemplate('mercenary', { source: 'pool', spot: 'street', weight: 3, mercenary: true, stats: STATS, open: ['punch'] });
const bard = parseTemplate('bard', { source: 'pool', spot: 'inn', weight: 1, stats: STATS, open: ['punch'] });
const miner = parseTemplate('dwarf_miner', { source: 'pool', spot: 'node', weight: 1, races: ['dwarf'], stats: STATS, open: ['punch'] });
const ranger = parseTemplate('elf_ranger', { source: 'pool', spot: 'street', weight: 1, races: ['elf'], stats: STATS, open: ['punch'],
  flag_moves: { '!element': ['shot'], element: ['palm_strike'] },
  flag_gear: { '!element': [{ item: 'oak_bow', slot: 'main_hand' }], element: [{ item: 'iron_knife', slot: 'main_hand' }] } });
const HUMAN = { race: 'human', visitors: [], visitorShare: 0, poolWeights: {} };
const RULES: UnlockRule[] = [{ move: 'flay', group: 'a', kind: 'mastery', params: { move: 'slice', level: 10 } }];
const opt = (name: string, cost: number, weight: number, modifiers: Record<string, unknown> = {}): TraitOption => ({ name, cost, weight, modifiers });
const DUAL_ONLY = [opt('dual_wielder', 150, 1, { dual_wield: true })]; // fits a quota of 150 to 300
const ELEMENT = [opt('elemental_affinity', 90, 1, { group: 'element', elements: 1, affinity: 100 })];

test('pool share: 5% in the outer ring, 1% less per ring inward, never below 1%', () => {
  assert.deepEqual([4, 3, 2, 1].map((r) => Math.round(poolShare(rc, r, 4) * 100)), [5, 4, 3, 2]);
  assert.equal(Math.round(poolShare(rc, 1, 8) * 100), 1);
  assert.equal(poolSize(rc, 4, 4, 300), 15);
  assert.equal(poolSize(rc, 1, 4, 2400), 48);
});

test('every town has an elder and a chief guard; bigger towns a merchant and a mayor', () => {
  assert.deepEqual(notablesFor(rc, 300), ['village_elder', 'chief_guard']);
  assert.deepEqual(notablesFor(rc, 1200), ['village_elder', 'chief_guard', 'merchant', 'mayor']);
});

test('the threshold grows with move levels and doubles for a lineage offer; mercenaries earn a daily wage', () => {
  assert.equal(recruitThreshold(rc, 20, false), 30);
  assert.equal(recruitThreshold(rc, 20, true), 60);
  assert.equal(mercenaryWage(rc, 20), 15);
});

test('joining needs favor, charm (as favor) and fame to beat the threshold; lineage twice as much', () => {
  assert.equal(recruitReady(rc, 1, { favor: 30, charm: 0, fame: 0, levels: 20, lineage: false }), true);
  assert.equal(recruitReady(rc, 1, { favor: 29, charm: 0, fame: 0, levels: 20, lineage: false }), false);
  assert.equal(recruitReady(rc, 1, { favor: 27, charm: 3, fame: 0, levels: 20, lineage: false }), true); // charm fills the gap
  assert.equal(recruitReady(rc, 2, { favor: 26, charm: 2, fame: 0, levels: 20, lineage: false }), true);
  assert.equal(recruitReady(rc, 1, { favor: 30, charm: 5, fame: 4, levels: 20, lineage: true }), false); // 60 for a child
  assert.equal(recruitReady(rc, 1, { favor: 55, charm: 3, fame: 2, levels: 20, lineage: true }), true);
});

test('a roster plan: notables, one offer per lineage template and parent, the pool up to its share', () => {
  const town = { ref: 't', ring: 4, population: 300, services: ['shop', 'temple', 'inn'], ...HUMAN };
  const all = [butcherson, healer, merc, bard];
  const plan = planRoster(rc, 4, town, all, { pool: 0, offering: new Set() }, createRng(1));
  assert.deepEqual(plan.lineage.map((l) => `${l.parent}|${l.template.name}`), ['shop|butcherson', 'temple|apprentice_healer']);
  assert.equal(plan.pool.length, 15);
  assert.ok(plan.pool.filter((p) => p.template.name === 'mercenary').length > plan.pool.filter((p) => p.template.name === 'bard').length);
  const again = planRoster(rc, 4, town, all, { pool: 15, offering: new Set(['shop|butcherson', 'temple|apprentice_healer']) }, createRng(2));
  assert.deepEqual([again.lineage.length, again.pool.length], [0, 0]);
});

test('a dwarf town: dwarf templates, lineage of its race only, about one visitor in ten; pool weights count', () => {
  const town = { ref: 'd', ring: 4, population: 3000, services: ['shop'], race: 'dwarf', visitors: ['human', 'elf'], visitorShare: 0.1,
    poolWeights: { mercenary: 0 } };
  const humanOnly = parseTemplate('shop_heir', { source: 'lineage', parents: ['shop'], races: ['human'], stats: STATS, open: ['punch'] });
  const plan = planRoster(rc, 4, town, [butcherson, humanOnly, merc, bard, miner, ranger], { pool: 0, offering: new Set() }, createRng(3));
  assert.deepEqual(plan.lineage.map((l) => `${l.template.name}:${l.race}`), ['butcherson:dwarf']);
  const visitors = plan.pool.filter((p) => p.race !== 'dwarf');
  assert.equal(plan.pool.length, 150);
  assert.ok(visitors.length > 5 && visitors.length < 30, `${visitors.length} visitors`);
  for (const p of plan.pool) {
    if (p.template.races.length > 0) assert.ok(p.template.races.includes(p.race), `${p.template.name} as ${p.race}`);
    if (p.race === 'dwarf') assert.notEqual(p.template.name, 'mercenary'); // weight 0 at home
  }
  assert.ok(plan.pool.some((p) => p.template.name === 'dwarf_miner'));
});

test('race stat mods add to the template; an elf without an element gets the bow, with one the knife', () => {
  const elf = { name: 'elf', statMods: { dex: 2, end: -2 } };
  let bows = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const r = rollRecruit(cfg, rc, ranger, 4, createRng(seed), [], ELEMENT, elf);
    assert.equal(r.race, 'elf');
    assert.deepEqual([r.stats.dex, r.stats.end], [STATS.dex + 2, STATS.end - 2]);
    const elemental = r.traits.some((t) => Array.isArray(t.params.elements));
    assert.deepEqual(r.gear.map((g) => g.item), [elemental ? 'iron_knife' : 'oak_bow'], `seed ${seed}`);
    if (!elemental) bows++;
  }
  assert.ok(bows > 0 && bows < 60);
});

test('a recruit keeps template stats in any ring; its budget is the ring budget +- 10; no stat exp is paid', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const r = rollRecruit(cfg, rc, butcherson, 4, createRng(seed), RULES, []);
    assert.deepEqual(r.stats, STATS);
    assert.ok(r.totalLevels >= 1 && r.totalLevels <= 20, `seed ${seed}: ${r.totalLevels}`);
    assert.ok(r.moves.every((m) => ['punch', 'knife_stab', 'slice', 'flay'].includes(m.name)));
    if (r.moves.some((m) => m.name === 'flay')) assert.ok((r.moves.find((m) => m.name === 'slice')?.level ?? 0) >= 10);
    assert.ok(r.life[0].level >= 5 && r.life[0].level <= 12);
    assert.deepEqual(r.gear, [{ item: 'iron_knife', slot: 'main_hand' }]);
  }
  assert.ok(rollRecruit(cfg, rc, butcherson, 1, createRng(1), RULES, []).totalLevels >= 70);
});

test('only the dual wield trait opens dual moves and a second knife', () => {
  let duals = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const r = rollRecruit(cfg, rc, butcherson, 1, createRng(seed), RULES, DUAL_ONLY);
    const dual = r.traits.some((t) => t.name === 'dual_wielder');
    if (dual) duals++;
    assert.equal(r.moves.some((m) => m.name === 'twin_stab' || m.name === 'cross_cut'), dual, `seed ${seed}`);
    assert.equal(r.gear.length, dual ? 2 : 1);
  }
  assert.ok(duals > 10 && duals < 50);
});

test('an apprentice healer always has holy affinity', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const r = rollRecruit(cfg, rc, healer, 4, createRng(seed), [], ELEMENT);
    const els = r.traits.flatMap((t) => (t.params.elements as string[] | undefined) ?? []);
    assert.ok(els.includes('holy'), `seed ${seed}`);
  }
});

test('the template check names bad moves, life skills in the wrong list, items and slots', () => {
  const bad = parseTemplate('bad', { source: 'pool', stats: { ...STATS, charm: 0 }, open: ['nope', 'butchery'], life: { punch: [1, 2] },
    gear: [{ item: 'ghost', slot: 'tail' }], elements: ['plasma'] });
  const cats = new Map([['punch', 'attack'], ['butchery', 'life']]);
  assert.equal(findTemplateProblems([bad], cats, new Set(['iron_knife']), ['main_hand'], ['holy']).length, 8);
  const lost = parseTemplate('lost', { source: 'campfire', races: ['orc'], stats: STATS, open: ['punch'] });
  assert.deepEqual(findTemplateProblems([lost], cats, new Set(), [], [], new Set(['human'])), ['recruit template lost: unknown race orc']);
});
