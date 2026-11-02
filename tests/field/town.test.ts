import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateField } from '../../server/field/generate.ts';
import { findFieldProblems, parseBiome, parseTemplate } from '../../server/field/parse.ts';
import { reachable } from '../../server/field/reach.ts';
import { townPlan } from '../../server/field/town.ts';
import type { FieldSpec } from '../../server/field/types.ts';

// Test copy of seeds/05_town/01_town and 33_town_layout.
const TOWN = {
  safe: 16, height: 0, ground: 'paving', road: 'road', building: 'building', door: 'door',
  buildings: [
    { service: 'inn', w: 4, h: 3 }, { service: 'shop', w: 3, h: 3 }, { service: 'temple', w: 3, h: 3 },
    { service: 'guild', w: 3, h: 3 }, { service: 'trainer', w: 3, h: 3 },
  ],
  view_reach: 1.1, houses: { max: 6, w: 2, h: 2 },
};
const REACH = 1.1;
const template = parseTemplate('town_square', 'town', 20, 20, { obstacle_mult: 1, town: TOWN });
const grove = parseBiome('grove', {
  ground: { grass: 3, moss: 2 }, obstacles: { tree: 5, rock: 1 }, obstacle_density: 0.22,
  hills: { max: 3, scale: 4, steep: 3.5 }, lowland: { share: 0.4, terrain: { swamp: 2, water: 1 } },
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
    assert.ok(g.tiles.filter((t) => t.terrain === 'building' && !t.walkable).length >= 4 * 3 + 4 * 3 * 3 - 5, `seed ${seed}`);
    const seen = reachable(g, g.spawn);
    assert.equal(seen.size, g.tiles.filter((t) => t.walkable).length, `seed ${seed}`);
    for (const e of g.exits) assert.ok(seen.has(e.y * 20 + e.x), `seed ${seed} exit ${e.id}`);
    assert.ok(g.tiles.filter((t) => t.safe && t.slope === null).every((t) => t.height === 0), `seed ${seed} flat square`);
  }
});

// True when building b hides tile p (same rule as town.ts, written out again).
function hides(b: { x: number; y: number; w: number; h: number }, p: { x: number; y: number }): boolean {
  const sx = p.x - p.y, row = p.x + p.y;
  const inCols = sx >= b.x - (b.y + b.h - 1) && sx <= b.x + b.w - 1 - b.y;
  return inCols && row < b.x + b.w - 1 + b.y + b.h - 1 && row >= b.x + b.y - Math.ceil(REACH * (b.w + b.h));
}

test('layouts are random per seed; doors face the camera with open ground in front, and none is hidden', () => {
  const layout = template.town!;
  const looks = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) {
    const plan = townPlan(20, 20, layout, seed);
    assert.deepEqual(plan.unplaced, [], `seed ${seed}`);
    looks.add(JSON.stringify(plan.placed.map((b) => [b.x, b.y])));
    const inside = (p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) =>
      p.x >= b.x && p.y >= b.y && p.x < b.x + b.w && p.y < b.y + b.h;
    for (const b of plan.placed) {
      if (!b.door) { assert.equal(b.service, null); continue; }
      const d = b.door;
      const onX = d.x === b.x + b.w - 1, onY = d.y === b.y + b.h - 1;
      assert.ok(onX || onY, `seed ${seed} ${b.service}: door on a +x or +y side`);
      const front = onX ? { x: d.x + 1, y: d.y } : { x: d.x, y: d.y + 1 };
      assert.ok(plan.placed.every((o) => !inside(front, o)), `seed ${seed} ${b.service}: open in front`);
      for (const o of plan.placed) if (o !== b) assert.ok(!hides(o, d), `seed ${seed}: ${o.service ?? 'house'} hides ${b.service}`);
    }
  }
  assert.ok(looks.size > 30, 'seeds give different towns');
  assert.ok(townPlan(20, 20, layout, 1).placed.some((b) => !b.service), 'houses fill the square');
});

test('the layout check catches a town that does not fit', () => {
  assert.deepEqual(findFieldProblems([template], []), []);
  const crowded = parseTemplate('tiny_town', 'town', 20, 20, { town: { ...TOWN, safe: 8 } });
  assert.match(findFieldProblems([crowded], []).join(' '), /no room/);
  const missing = parseTemplate('bare', 'town', 20, 20, {});
  assert.match(findFieldProblems([missing], []).join(' '), /needs a town layout/);
});
