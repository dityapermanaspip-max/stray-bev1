import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canStep, MAX_HEIGHT, meetHeight } from '../../server/field/climb.ts';
import { generateField } from '../../server/field/generate.ts';
import { parseBiome, parseTemplate } from '../../server/field/parse.ts';
import { findPath } from '../../server/field/path.ts';
import { reachable } from '../../server/field/reach.ts';
import type { FieldGrid, Tile } from '../../server/field/types.ts';

// One row of tiles at the given heights.
function row(heights: number[]): FieldGrid {
  const tiles: Tile[] = heights.map((height) => ({ terrain: 'grass', biome: 'meadow', height, walkable: true, slope: null }));
  return { width: heights.length, height: 1, tiles, spawn: { x: 0, y: 0 }, exits: [], nodes: [] };
}
const at = (x: number) => ({ x, y: 0 });

test('a step may rise or drop one level; two or more is a cliff', () => {
  const g = row([1, 1, 2, 0, 5]);
  assert.ok(canStep(g, at(0), at(1)), 'same height');
  assert.ok(canStep(g, at(1), at(2)), 'up one level');
  assert.ok(canStep(g, at(2), at(1)), 'down one level');
  assert.ok(!canStep(g, at(2), at(3)), 'two levels');
  assert.ok(!canStep(g, at(3), at(4)), 'five levels');
  assert.ok(!canStep(g, at(0), at(2)), 'not a neighbour');
  g.tiles[1].walkable = false;
  assert.ok(!canStep(g, at(0), at(1)), 'blocked');
});

test('stairs climb one level per tile', () => {
  const g = row([0, 1, 2, 3, 4, 5]);
  assert.deepEqual(findPath(g, at(0), at(5), 10), [at(1), at(2), at(3), at(4), at(5)]);
  assert.equal(findPath(row([0, 2]), at(0), at(1), 10), null);
});

test('meetHeight keeps a height within a step of the next tile, as close to it as it can', () => {
  assert.equal(meetHeight(4, 1), 2);
  assert.equal(meetHeight(0, 3), 2);
  assert.equal(meetHeight(2, 2), 2);
  assert.equal(meetHeight(1, 2), 1);
});

test('generated fields: heights 0-5, flat blocks only, water only at 0, every walkable tile and exit reachable', () => {
  const t = parseTemplate('open_field', 'open', 20, 20, { obstacle_mult: 1 });
  const crag = parseBiome('crag', {
    ground: { grass: 1 }, obstacles: { tree: 1 }, obstacle_density: 0.1,
    hills: { max: MAX_HEIGHT, scale: 4, steep: 3.5 }, lowland: { share: 0.4, terrain: { swamp: 1 } },
  });
  let tall = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const g = generateField({ template: t, biomeA: crag, biomeB: null, blend: { from: 0, to: 0 }, seed });
    const seen = reachable(g, g.spawn);
    g.tiles.forEach((tile, i) => {
      assert.ok(tile.height >= 0 && tile.height <= MAX_HEIGHT);
      assert.equal(tile.slope, null, 'no slopes');
      if (tile.terrain === 'swamp' || tile.terrain === 'water') assert.ok(tile.height === 0 && !tile.walkable, `seed ${seed}: water only at 0`);
      if (tile.walkable) assert.ok(seen.has(i), `seed ${seed}: tile ${i} reachable`);
      if (tile.height >= 4) tall++;
    });
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
  assert.ok(tall > 0, 'high ground appears');
});
