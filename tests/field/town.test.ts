import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateField } from '../../server/field/generate.ts';
import { findFieldProblems, parseBiome, parseTemplate } from '../../server/field/parse.ts';
import { reachable } from '../../server/field/reach.ts';
import { townPlan } from '../../server/field/town.ts';
import type { FieldSpec } from '../../server/field/types.ts';

// Test copy of seeds/23_town.
const TOWN = {
  safe: 16, height: 0, ground: 'paving', road: 'road', building: 'building', door: 'door',
  buildings: [
    { service: 'inn', w: 4, h: 3 }, { service: 'shop', w: 3, h: 3 }, { service: 'temple', w: 3, h: 3 },
    { service: 'guild', w: 3, h: 3 }, { service: 'trainer', w: 3, h: 3 },
  ],
};
const template = parseTemplate('town_square', 'town', 20, 20, { obstacle_mult: 1, town: TOWN });
const grove = parseBiome('grove', {
  ground: { grass: 3, moss: 2 }, obstacles: { tree: 5, rock: 1 }, obstacle_density: 0.22,
  hills: { max: 3, scale: 4, steep: 3.5 }, lowland: { share: 0.4, terrain: { swamp: 2, water: 1 } }, slope_share: 0.3,
});
const spec = (seed: number): FieldSpec => ({ template, biomeA: grove, biomeB: null, blend: { from: 0, to: 0 }, seed });

test('the town square sits in the middle of a normal-size field with a wild edge', () => {
  const g = generateField(spec(3));
  assert.equal(g.width, 20);
  const safe = g.tiles.map((t, i) => (t.safe ? i : -1)).filter((i) => i >= 0);
  assert.equal(safe.length, 16 * 16);
  for (const i of safe) {
    const x = i % 20, y = Math.floor(i / 20);
    assert.ok(x >= 2 && x <= 17 && y >= 2 && y <= 17);
  }
  assert.deepEqual(g.spawn, { x: 10, y: 10 });
  assert.ok(g.tiles[g.spawn.y * 20 + g.spawn.x].safe);
});

test('every building is placed, blocked except one door per service, and all of it stays reachable', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = generateField(spec(seed));
    const doors = g.tiles.filter((t) => t.service);
    assert.deepEqual(doors.map((t) => t.service).sort(), ['guild', 'inn', 'shop', 'temple', 'trainer'], `seed ${seed}`);
    assert.ok(doors.every((t) => t.walkable && t.terrain === 'door'));
    assert.equal(g.tiles.filter((t) => t.terrain === 'building' && !t.walkable).length, 4 * 3 + 4 * 3 * 3 - 5, `seed ${seed}`);
    const seen = reachable(g, g.spawn);
    assert.equal(seen.size, g.tiles.filter((t) => t.walkable).length, `seed ${seed}`);
    for (const e of g.exits) assert.ok(seen.has(e.y * 20 + e.x), `seed ${seed} exit ${e.id}`);
    assert.ok(g.tiles.filter((t) => t.safe && t.slope === null).every((t) => t.height === 0), `seed ${seed} flat square`);
  }
});

test('doors face the road and the layout check catches a town that does not fit', () => {
  const plan = townPlan(20, 20, TOWN);
  assert.deepEqual(plan.unplaced, []);
  for (const b of plan.placed) assert.equal(Math.abs(b.door.y - plan.road.y), 1);
  assert.deepEqual(findFieldProblems([template], []), []);
  const crowded = parseTemplate('tiny_town', 'town', 20, 20, { town: { ...TOWN, safe: 8 } });
  assert.match(findFieldProblems([crowded], []).join(' '), /no room/);
  const missing = parseTemplate('bare', 'town', 20, 20, {});
  assert.match(findFieldProblems([missing], []).join(' '), /needs a town layout/);
});
