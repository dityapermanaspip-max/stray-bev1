import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateField } from '../../server/field/generate.ts';
import { besideTiles, corruptionShare, isDark, placeNodes, walkPlan } from '../../server/field/nodes.ts';
import { reachable } from '../../server/field/reach.ts';
import { parseBiome, parseTemplate } from '../../server/field/parse.ts';
import { tileAt, type FieldSpec } from '../../server/field/types.ts';
import { guards, rollFinds, toolMult } from '../../server/gather/gather.ts';
import { addItem, emptyInventory } from '../../server/inventory/bag.ts';
import { parseItem } from '../../server/inventory/items.ts';
import { createRng } from '../../server/util/rng.ts';
import { cfg } from '../fixtures/battle_data.ts';
import { catalog as baseCatalog } from '../fixtures/items.ts';

const openField = parseTemplate('open_field', 'open', 20, 20, { obstacle_mult: 1 });
const meadow = parseBiome('meadow', {
  ground: { grass: 6, dirt: 1 }, obstacles: { bush: 2, rock: 1 }, obstacle_density: 0.08,
  hills: { max: 3, scale: 4, steep: 2.5 }, lowland: { share: 0.35, terrain: { water: 1 } },
  nodes: { rock: 3, fish: 2 },
});
const spec = (seed: number): FieldSpec => ({ template: openField, biomeA: meadow, biomeB: null, blend: { from: 0, to: 0 }, seed });
const near = { fish: ['water'] };
const nodesOf = (seed: number) => placeNodes(generateField(spec(seed)), spec(seed), near);

test('nodes: same seed same nodes, obstacles worked from beside, field stays connected, fish beside water', () => {
  assert.deepEqual(nodesOf(5), nodesOf(5));
  for (let seed = 1; seed <= 30; seed++) {
    const g = generateField(spec(seed));
    const before = reachable(g, g.spawn).size;
    const nodes = placeNodes(g, spec(seed), near);
    const seen = reachable(g, g.spawn);
    assert.equal(seen.size, before - nodes.length, `seed ${seed}: blocking nodes cut nothing off`);
    for (const e of g.exits) assert.ok(seen.has(e.y * g.width + e.x), `seed ${seed}: exit ${e.id}`);
    assert.ok(nodes.filter((n) => n.kind === 'rock').length === 3, `seed ${seed} rocks`);
    for (const n of nodes) {
      assert.ok(!tileAt(g, n.x, n.y)?.walkable && !tileAt(g, n.x, n.y)?.service, 'a node is an obstacle');
      assert.ok(besideTiles(g, n).some((p) => seen.has(p.y * g.width + p.x)), `seed ${seed}: a reachable tile beside it`);
      for (const m of nodes) if (m !== n) assert.ok(Math.max(Math.abs(m.x - n.x), Math.abs(m.y - n.y)) > 1, `seed ${seed} neighbours`);
      if (n.kind === 'fish') assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(g, n.x + dx, n.y + dy)?.terrain === 'water'));
      assert.ok(!g.exits.some((e) => Math.abs(e.x - n.x) <= 1 && Math.abs(e.y - n.y) <= 1), 'not by an exit');
    }
  }
});

test('walking to a node ends beside it', () => {
  const g = generateField(spec(4));
  g.nodes = placeNodes(g, spec(4), near);
  const n = g.nodes[0];
  const { path, node } = walkPlan(g, g.spawn, n, 400);
  assert.equal(node, n);
  const end = path!.at(-1) ?? g.spawn;
  assert.ok(besideTiles(g, n).some((p) => p.x === end.x && p.y === end.y));
});

test('dark nodes follow the hidden corruption share', () => {
  const nodes = nodesOf(3);
  assert.equal(nodes.filter((n) => isDark(n, 0)).length, 0);
  assert.equal(nodes.filter((n) => isDark(n, 1)).length, nodes.length);
  assert.equal(corruptionShare([{ natives: 30, corrupted: 10 }, { natives: 0, corrupted: 0 }]), 0.25);
  const half = nodes.filter((n) => isDark(n, 0.5));
  assert.ok(nodes.filter((n) => isDark(n, 0.9)).length >= half.length); // more darken as corruption spreads
});

const catalog = new Map([...baseCatalog, ['pickaxe', parseItem('pickaxe', 'tool', 'pickaxe', null, { weight: 3, tool_type: 'pick' })]]);
const rock = cfg.gather.kinds.rock;

test('a node needs a fitting tool; a bonus tool works better', () => {
  const inv = emptyInventory();
  assert.equal(toolMult(rock, catalog, inv), null);
  addItem(catalog, inv, 'iron_sword', 1);
  assert.equal(toolMult(rock, catalog, inv), null); // a sword does not mine
  addItem(catalog, inv, 'iron_hammer', 1);
  assert.equal(toolMult(rock, catalog, inv), 1);
  addItem(catalog, inv, 'pickaxe', 1);
  assert.equal(toolMult(rock, catalog, inv), rock.bonusMult);
});

test('finds: each entry rolls on its own; skill and a bonus tool raise the chances', () => {
  const entries = [{ item: 'river_stone', permille: 1000, min: 1, max: 3 }, { item: 'copper_ore', permille: 100, min: 1, max: 1 }];
  const count = (level: number, mult: number) => {
    const rng = createRng(9);
    let ore = 0;
    for (let i = 0; i < 2000; i++) {
      const finds = rollFinds(cfg.gather, cfg.luck, entries, level, mult, 0, rng);
      for (const f of finds.filter((x) => x.item === 'river_stone')) assert.ok(f.qty >= 1 && f.qty <= 3);
      ore += finds.filter((f) => f.item === 'copper_ore').length;
    }
    return ore;
  };
  const low = count(1, 1);
  assert.ok(low > 120 && low < 220, `level 1: ${low}`); // about 1000 x 0.1 x 0.82 per 1000
  assert.ok(count(20, 1.3) > low * 1.4);
});

test('guards of a dark node are corrupted creatures of the field', () => {
  const rows = [{ species: 'chicken', natives: 50, corrupted: 0, safe: 5, max: 100 }, { species: 'lizard', natives: 10, corrupted: 20, safe: 2, max: 50 }];
  const rng = createRng(4);
  for (let i = 0; i < 50; i++) {
    const foes = guards(cfg.encounter, rows, rng, cfg.encounter.groupMax);
    assert.ok(foes.length >= 1 && foes.every((f) => f.species === 'lizard' && f.corrupted));
  }
  assert.deepEqual(guards(cfg.encounter, [rows[0]], rng, 3), []);
});
