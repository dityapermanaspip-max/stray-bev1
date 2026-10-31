import assert from 'node:assert/strict';
import { test } from 'node:test';
import { directionTo, linkExit, type WorldLinks } from '../../server/field/links.ts';
import { findPath } from '../../server/field/path.ts';
import type { FieldGrid, Tile } from '../../server/field/types.ts';
import { advance, newWalker, walkSpeed } from '../../server/field/walker.ts';
import { cfg } from '../fixtures/battle_data.ts';

// 5x3, a wall in column 2 except the bottom row:
// . . # . .
// . . # . .
// . . . . .
function grid(): FieldGrid {
  const tiles: Tile[] = [];
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 5; x++) tiles.push({ terrain: 'grass', biome: 'meadow', height: 0, walkable: !(x === 2 && y < 2), slope: null });
  }
  return { width: 5, height: 3, tiles, spawn: { x: 0, y: 0 }, exits: [] };
}

test('paths go around walls, refuse blocked or unreachable targets, and respect the step cap', () => {
  const g = grid();
  const path = findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 }, 50)!;
  assert.equal(path.length, 8);
  assert.deepEqual(path[path.length - 1], { x: 4, y: 0 });
  assert.ok(path.every((p) => !(p.x === 2 && p.y < 2)));
  assert.equal(findPath(g, { x: 0, y: 0 }, { x: 2, y: 0 }, 50), null);
  assert.equal(findPath(g, { x: 0, y: 0 }, { x: 9, y: 9 }, 50), null);
  assert.deepEqual(findPath(g, { x: 1, y: 1 }, { x: 1, y: 1 }, 50), []);
  assert.equal(findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 }, 5), null);
});

test('walkers move at the tile rate; heavy loads slow down and the last tier cannot move', () => {
  const w = newWalker({ x: 0, y: 0 });
  w.path = findPath(grid(), w, { x: 0, y: 2 }, 50)!;
  assert.deepEqual(advance(w, 0.2, 3), []); // 0.6 of a tile
  assert.deepEqual(advance(w, 0.2, 3), [{ x: 0, y: 1 }]);
  assert.deepEqual(advance(w, 1, 3), [{ x: 0, y: 2 }]);
  assert.equal(w.progress, 0);
  assert.equal(walkSpeed(cfg, 1), 3);
  assert.ok(Math.abs(walkSpeed(cfg, 3) - 1.8) < 1e-9); // slow_walk_mult 0.6
  assert.equal(walkSpeed(cfg, 4), 0);
});

test('exits link hex to corridor chain to hex, both ways', () => {
  const a = { id: 'A', q: 0, r: 0 };
  const b = { id: 'B', q: 1, r: 0 };
  const world: WorldLinks = { hexes: new Map([['A', a], ['B', b]]), borders: [{ a, b, corridors: ['c1', 'c2', 'c3'] }] };
  assert.equal(directionTo(a, b), 0);
  assert.equal(directionTo(b, a), 3);
  assert.deepEqual(linkExit(world, 'A', 'd0'), { ref: 'c1', exit: 'a' });
  assert.deepEqual(linkExit(world, 'c1', 'b'), { ref: 'c2', exit: 'a' });
  assert.deepEqual(linkExit(world, 'c3', 'b'), { ref: 'B', exit: 'd3' });
  assert.deepEqual(linkExit(world, 'B', 'd3'), { ref: 'c3', exit: 'b' });
  assert.deepEqual(linkExit(world, 'c1', 'a'), { ref: 'A', exit: 'd0' });
  assert.equal(linkExit(world, 'A', 'd2'), null); // no border that way
});
