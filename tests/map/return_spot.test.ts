import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FieldGrid } from '../../server/field/types.ts';
import { returnSpot } from '../../server/map/travel.ts';

// A 3x1 grid with the shop door on its last tile.
const grid = { width: 3, height: 1, nodes: [], exits: [], tiles: [{}, {}, { service: 'shop' }] } as unknown as FieldGrid;

test('coming out of a room puts the player on the tile they went in from, when it is still a legal exit', () => {
  assert.deepEqual(returnSpot(grid, 'door:shop', { x: 2, y: 0 }), { x: 2, y: 0 });
});

test('a remembered tile that is not beside the door or node is ignored', () => {
  assert.equal(returnSpot(grid, 'door:shop', { x: 0, y: 0 }), null);
  assert.equal(returnSpot(grid, 'door:shop', undefined), null);
  assert.equal(returnSpot(grid, 'node:9', { x: 0, y: 0 }), null);
});
