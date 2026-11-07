import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RoomLayout } from '../../server/config/interior_config.ts';
import { buildInterior, findRoomProblems } from '../../server/interior/interior_grid.ts';
import { baseRef, interiorRef, parseInterior } from '../../server/interior/interior_ref.ts';
import { withNpcs } from '../../server/interior/npc_place.ts';
import { linkExit } from '../../server/field/links.ts';
import { tileAt } from '../../server/field/types.ts';

const inn: RoomLayout = {
  biome: 'interior', w: 11, h: 9, floor: 'floor_wood', wall: 'wall_wood',
  props: [{ terrain: 'counter', x: 1, y: 3, w: 3, h: 1 }, { terrain: 'table', x: 8, y: 6, w: 1, h: 1 }],
  keeper: { x: 4, y: 3 }, guests: [{ x: 3, y: 6 }, { x: 9, y: 5 }], rest: null,
};

test('a ref names its parent, kind and node, and a plain field is its own base', () => {
  assert.deepEqual(parseInterior(interiorRef('T1', 'shop')), { parent: 'T1', kind: 'shop', node: null });
  assert.deepEqual(parseInterior(interiorRef('H9', 'camp', 4)), { parent: 'H9', kind: 'camp', node: 4 });
  assert.equal(parseInterior('plain-field'), null);
  assert.equal(parseInterior('H9~camp.x'), null);
  assert.equal(baseRef('T1~inn'), 'T1');
  assert.equal(baseRef('T1'), 'T1');
});

test('a room has back walls, blocked props, and its door in the middle of the last row', () => {
  const g = buildInterior(inn);
  assert.equal(tileAt(g, 0, 5)?.walkable, false);
  assert.equal(tileAt(g, 5, 0)?.terrain, 'wall_wood');
  assert.equal(tileAt(g, 2, 3)?.terrain, 'counter');
  assert.equal(tileAt(g, 2, 3)?.walkable, false);
  assert.deepEqual(g.exits, [{ id: 'door', x: 5, y: 8 }]);
  assert.deepEqual(g.spawn, { x: 5, y: 8 });
  assert.deepEqual(findRoomProblems('inn', inn), []);
});

test('a seat behind a wall of props is a problem', () => {
  const walled: RoomLayout = { ...inn, props: [{ terrain: 'table', x: 1, y: 5, w: 10, h: 1 }], guests: [{ x: 3, y: 2 }] };
  assert.ok(findRoomProblems('inn', walled).some((p) => p.includes('guest seat 0')));
});

test('people block their tiles in a copy, and the base grid stays empty', () => {
  const base = buildInterior(inn);
  const grid = withNpcs(base, [{ id: 0, entity: 'e', name: 'N', role: 'inn', sex: null, look: null, x: 4, y: 3 }]);
  assert.equal(tileAt(grid, 4, 3)?.walkable, false);
  assert.equal(tileAt(base, 4, 3)?.walkable, true);
  assert.deepEqual(grid.nodes.map((n) => [n.id, n.kind]), [[0, 'npc']]);
});

test('a room exit leads back to where it hangs off', () => {
  const links = { hexes: new Map(), borders: [], towns: new Map() };
  assert.deepEqual(linkExit(links, 'T1~shop', 'door'), { ref: 'T1', exit: 'door:shop' });
  assert.deepEqual(linkExit(links, 'H1~camp.3', 'door'), { ref: 'H1', exit: 'node:3' });
  assert.equal(linkExit(links, 'T1~shop', 'gate'), null);
});

test('a camp: the bed and the campfire are props worked from beside them, and both can be reached', async () => {
  const { walkPlan, nodeBeside } = await import('../../server/field/nodes.ts');
  const camp: RoomLayout = {
    biome: 'camp', w: 9, h: 9, floor: 'camp_ground', wall: 'camp_trees',
    props: [{ terrain: 'campfire', x: 4, y: 3, w: 1, h: 1, use: 'cook' }, { terrain: 'log', x: 2, y: 3, w: 1, h: 1 }, { terrain: 'bed', x: 7, y: 5, w: 1, h: 2, use: 'camp' }],
    keeper: null, guests: [], rest: null,
  };
  assert.deepEqual(findRoomProblems('camp', camp), []);
  const grid = withNpcs(buildInterior(camp), [], camp.props);
  assert.deepEqual(grid.nodes.map((n) => [n.kind, n.x, n.y]), [['use:cook', 4, 3], ['use:camp', 7, 5], ['use:camp', 7, 6]]);
  for (const n of grid.nodes) {
    const plan = walkPlan(grid, grid.spawn, { x: n.x, y: n.y }, 100);
    assert.equal(plan.node?.id, n.id);
    assert.ok(plan.path && plan.path.length > 0, `${n.kind} at ${n.x},${n.y} can be walked up to`);
    const end = plan.path![plan.path!.length - 1];
    assert.equal(nodeBeside(grid, end, n.id)?.id, n.id);
  }
});
