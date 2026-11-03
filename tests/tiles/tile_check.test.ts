import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findTileProblems } from '../../server/tiles/tile_check.ts';
import type { CatalogTile } from '../../server/tiles/tile_repo.ts';

const tile = (o: Partial<CatalogTile> & { key: string }): CatalogTile => ({
  atlas: 'walk', terrain: o.key, biome: 'any', walkable: true, sheet: 's', cell: 0, mirrorOf: null, edge: null, edgeOf: null, weight: 1, nodeKind: null, ...o,
});
const room = { biome: 'interior', w: 5, h: 5, floor: 'floor', wall: 'wall', props: [{ terrain: 'well', x: 1, y: 1, w: 1, h: 1 }], keeper: null, guests: [], rest: null };

test('a consistent catalog has no problems', () => {
  const tiles = [
    tile({ key: 'floor', cell: 0 }), tile({ key: 'wall', atlas: 'block', walkable: false, cell: 1 }),
    tile({ key: 'well', atlas: 'obstacle', walkable: false, cell: 2 }),
    tile({ key: 'floor_flip', terrain: 'floor', sheet: null, cell: null, mirrorOf: 'floor' }),
  ];
  assert.deepEqual(findTileProblems(tiles, { r: room }), []);
});

test('a cell used twice, a bad mirror and a split terrain are found', () => {
  const tiles = [
    tile({ key: 'a', terrain: 't', cell: 0 }), tile({ key: 'b', terrain: 't', atlas: 'block', walkable: false, cell: 0 }),
    tile({ key: 'c', sheet: null, cell: null, mirrorOf: 'b' }),
  ];
  const found = findTileProblems(tiles, {}).join('|');
  assert.match(found, /s:0 is used/);
  assert.match(found, /mirrors b/);
  assert.match(found, /terrain t: some tiles/);
});

test('a room that walks on a wall is found', () => {
  const tiles = [tile({ key: 'floor' }), tile({ key: 'wall', cell: 1 }), tile({ key: 'well', cell: 2 })];
  const found = findTileProblems(tiles, { r: room }).join('|');
  assert.match(found, /wall wall is walkable/);
  assert.match(found, /well is walkable/);
});
