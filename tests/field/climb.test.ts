import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canStep, placeSlope, slopeFits, STEPS } from '../../server/field/climb.ts';
import { generateField } from '../../server/field/generate.ts';
import { parseBiome, parseTemplate } from '../../server/field/parse.ts';
import { findPath } from '../../server/field/path.ts';
import type { FieldGrid, Tile } from '../../server/field/types.ts';

// One row of flat tiles at the given heights.
function row(heights: number[]): FieldGrid {
  const tiles: Tile[] = heights.map((height) => ({ terrain: 'grass', biome: 'meadow', height, walkable: true, slope: null }));
  return { width: heights.length, height: 1, tiles, spawn: { x: 0, y: 0 }, exits: [], nodes: [] };
}
const at = (x: number) => ({ x, y: 0 });

test('one level is a free step, two or more is a cliff', () => {
  const g = row([0, 1, 3, 3]);
  assert.ok(canStep(g, at(0), at(1)));
  assert.ok(canStep(g, at(1), at(0)));
  assert.ok(!canStep(g, at(1), at(2)));
  assert.ok(!canStep(g, at(2), at(1)));
  assert.ok(!canStep(g, at(0), at(2)), 'not a neighbor');
});

test('a slope bridges a rise of 2, and a rise of 3 with one free step', () => {
  const two = row([0, 0, 2]);
  assert.ok(slopeFits(two, at(1), at(2)));
  placeSlope(two, at(1), at(2));
  assert.deepEqual([two.tiles[1].height, two.tiles[1].slope], [1, 0]);
  assert.deepEqual(findPath(two, at(0), at(2), 10), [at(1), at(2)]);
  assert.deepEqual(findPath(two, at(2), at(0), 10), [at(1), at(0)]);

  const three = row([0, 0, 3]);
  placeSlope(three, at(1), at(2));
  assert.ok(canStep(three, at(1), at(2)) && canStep(three, at(0), at(1)));
  assert.ok(!slopeFits(row([0, 1]), at(0), at(1)), 'a one-level step needs no slope');
});

test('a slope walked from the wrong side is still a cliff', () => {
  // slope at x=1 rising toward -x: its +x edge is low (0), so the 2 on the right cannot be reached
  const g = row([2, 1, 2]);
  g.tiles[1].slope = STEPS.findIndex(([dx, dy]) => dx === -1 && dy === 0);
  assert.ok(canStep(g, at(0), at(1)));
  assert.ok(!canStep(g, at(1), at(2)));
});

test('generated fields: heights 0-3, water only on the lowest ground, every path climbs legally', () => {
  const t = parseTemplate('open_field', 'open', 20, 20, { obstacle_mult: 1 });
  const grove = parseBiome('grove', {
    ground: { grass: 1 }, obstacles: { tree: 1 }, obstacle_density: 0.1,
    hills: { max: 3, scale: 4, steep: 3.5 }, lowland: { share: 0.4, terrain: { swamp: 1 } }, slope_share: 0.3,
  });
  let slopes = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const g = generateField({ template: t, biomeA: grove, biomeB: null, blend: { from: 0, to: 0 }, seed });
    for (const tile of g.tiles) {
      assert.ok(tile.height >= 0 && tile.height <= 3);
      if (tile.terrain === 'swamp') assert.ok(tile.height === 0 && !tile.walkable);
      if (tile.slope !== null) slopes++;
    }
    for (const e of g.exits) {
      const path = findPath(g, g.spawn, e, 400);
      assert.ok(path, `seed ${seed} exit ${e.id}`);
      let from = g.spawn;
      for (const p of path) {
        assert.ok(canStep(g, from, p));
        from = p;
      }
    }
  }
  assert.ok(slopes > 0, 'some slopes appear');
});
