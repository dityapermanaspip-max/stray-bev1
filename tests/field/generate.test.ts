import assert from 'node:assert/strict';
import { test } from 'node:test';
import { corridorBlend, generateField } from '../../server/field/generate.ts';
import { findFieldProblems, parseBiome, parseTemplate } from '../../server/field/parse.ts';
import { canStep } from '../../server/field/climb.ts';
import { reachable } from '../../server/field/reach.ts';
import type { FieldGrid, FieldSpec } from '../../server/field/types.ts';

// Test copies of seeds/04_world/01_fields and 03_slopes.
const openField = parseTemplate('open_field', 'open', 20, 20, { obstacle_mult: 1 });
const corridor = parseTemplate('corridor_path', 'corridor', 8, 20, { obstacle_mult: 0.8 });
const meadow = parseBiome('meadow', {
  ground: { grass: 6, tall_grass: 2, flowers: 1, dirt: 1 }, obstacles: { bush: 2, rock: 1 }, obstacle_density: 0.08,
  hills: { max: 2, scale: 4, steep: 2.5 }, lowland: { share: 0.35, terrain: { water: 1 } }, slope_share: 0.5,
});
const grove = parseBiome('grove', {
  ground: { grass: 3, moss: 2, dirt: 2, leaves: 2 }, obstacles: { tree: 5, rock: 1, bush: 1 }, obstacle_density: 0.22,
  hills: { max: 3, scale: 4, steep: 3.5 }, lowland: { share: 0.4, terrain: { swamp: 2, water: 1 } }, slope_share: 0.3,
});

const open = (seed: number, biome = meadow): FieldSpec => ({ template: openField, biomeA: biome, biomeB: null, blend: { from: 0, to: 0 }, seed });
const wet = new Set(['water', 'swamp']);
const blocked = (g: FieldGrid) => g.tiles.filter((t) => !t.walkable && !wet.has(t.terrain)).length / g.tiles.length;

test('the same spec always gives the same field, another seed another field', () => {
  assert.deepEqual(generateField(open(7)), generateField(open(7)));
  assert.notDeepEqual(generateField(open(7)).tiles, generateField(open(8)).tiles);
});

test('every walkable tile and every exit is reachable from the spawn', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const spec of [open(seed, grove), { ...open(seed, meadow), template: corridor, biomeB: grove, blend: { from: 0, to: 1 } }]) {
      const g = generateField(spec);
      const seen = reachable(g, g.spawn);
      assert.equal(seen.size, g.tiles.filter((t) => t.walkable).length, `seed ${seed} ${spec.template.name}`);
      for (const e of g.exits) assert.ok(seen.has(e.y * g.width + e.x), `seed ${seed} exit ${e.id}`);
    }
  }
});

test('blocked share stays near biome density x template mult', () => {
  const avg = (biome: typeof meadow) => {
    let sum = 0;
    for (let seed = 1; seed <= 30; seed++) sum += blocked(generateField(open(seed, biome)));
    return sum / 30;
  };
  assert.ok(Math.abs(avg(meadow) - 0.08) < 0.04, `meadow ${avg(meadow)}`);
  assert.ok(Math.abs(avg(grove) - 0.22) < 0.06, `grove ${avg(grove)}`);
});

test('open fields have six edge exits, corridors one at each end', () => {
  const g = generateField(open(3));
  assert.deepEqual(g.exits.map((e) => e.id), ['d0', 'd1', 'd2', 'd3', 'd4', 'd5']);
  for (const e of g.exits) assert.ok(e.x === 0 || e.y === 0 || e.x === 19 || e.y === 19, `${e.id} on the edge`);
  const c = generateField({ ...open(3), template: corridor });
  assert.deepEqual(c.exits.map((e) => [e.id, e.y]), [['a', 0], ['b', 19]]);
});

test('a corridor chain shifts from biome A to biome B along the way', () => {
  assert.deepEqual([1, 2, 3].map((p) => corridorBlend(p, 3)), [{ from: 0, to: 1 / 3 }, { from: 1 / 3, to: 2 / 3 }, { from: 2 / 3, to: 1 }]);
  let startB = 0;
  let endB = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const g = generateField({ template: corridor, biomeA: meadow, biomeB: grove, blend: { from: 0, to: 1 }, seed });
    const rows = (y0: number, y1: number) => g.tiles.slice(y0 * 8, y1 * 8).filter((t) => t.biome === 'grove').length;
    startB += rows(0, 5);
    endB += rows(15, 20);
  }
  assert.ok(startB < endB / 3, `grove near start ${startB}, near end ${endB}`);
});

test('bad templates and biomes are reported', () => {
  const bad = parseBiome('swamp', { ground: {}, obstacle_density: 0.9, hills: { max: 6, scale: 0, steep: 9 }, lowland: { share: 0.5 } });
  assert.deepEqual(findFieldProblems([parseTemplate('x', 'open', 10, 10, { obstacle_mult: -1 })], [bad]), [
    'template x: obstacle_mult must be 0 or more',
    'biome swamp: needs at least one ground terrain',
    'biome swamp: obstacle_density must be 0-0.5',
    'biome swamp: has density but no obstacle terrain',
    'biome swamp: hills need max 0-5 and scale >= 1',
    'biome swamp: hills steep must be 1-8',
    'biome swamp: has lowland share but no lowland terrain',
  ]);
});

test('a hex that holds a town: a walled block in the middle, its gate below it, all reachable', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const g = generateField({ ...open(seed), gate: true });
    const cx = Math.floor(g.width / 2);
    const cy = Math.floor(g.height / 2);
    const gate = g.exits.find((e) => e.id === 'gate')!;
    assert.deepEqual({ x: gate.x, y: gate.y }, { x: cx, y: cy + 2 });
    assert.equal(g.tiles[cy * g.width + cx].terrain, 'building');
    assert.equal(g.tiles[cy * g.width + cx].walkable, false);
    const seen = reachable(g, g.spawn);
    assert.ok(seen.has(gate.y * g.width + gate.x), `seed ${seed}: gate reachable`);
    assert.equal(g.exits.length, 7);
  }
});

test('final grids: water only at height 0, flat blocks, moves work both ways and climb at most one level', () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const spec of [open(seed, meadow), open(seed, grove), { ...open(seed, meadow), template: corridor, biomeB: grove, blend: { from: 0, to: 1 } }]) {
      const g = generateField(spec);
      g.tiles.forEach((t, i) => {
        if (wet.has(t.terrain)) assert.equal(t.height, 0, `seed ${seed}: water at ${i}`);
        const x = i % g.width, y = Math.floor(i / g.width);
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          if (x + dx >= g.width || y + dy >= g.height) continue;
          const n = g.tiles[(y + dy) * g.width + x + dx];
          const legal = canStep(g, { x, y }, { x: x + dx, y: y + dy });
          assert.equal(legal, canStep(g, { x: x + dx, y: y + dy }, { x, y }), 'moves work both ways');
          assert.equal(t.slope, null);
          if (legal) assert.ok(Math.abs(t.height - n.height) <= 1, `seed ${seed}: step of two at ${i}`);
        }
      });
    }
  }
});
