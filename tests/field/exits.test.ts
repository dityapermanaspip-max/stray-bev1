import assert from 'node:assert/strict';
import { test } from 'node:test';
import { corridorExits, hexExit, progress } from '../../server/field/exits.ts';
import { generateField } from '../../server/field/generate.ts';
import { parseBiome, parseTemplate } from '../../server/field/parse.ts';
import { reachable } from '../../server/field/reach.ts';
import { corridorTemplate, findCorridorProblems } from '../../server/worldgen/corridor_templates.ts';

const SIZES: [number, number][] = [[12, 20], [20, 12], [16, 18], [18, 16], [10, 22], [22, 10]];

test('a corridor is entered where the hex behind it lies and left where the next one lies', () => {
  for (const [w, h] of SIZES) {
    for (let dir = 0; dir < 6; dir++) {
      const [a, b] = corridorExits(dir, w, h);
      assert.deepEqual({ x: b.x, y: b.y }, hexExit(dir, w, h));
      assert.deepEqual({ x: a.x, y: a.y }, hexExit((dir + 3) % 6, w, h));
      assert.ok(a.x >= 0 && a.y >= 0 && a.x < w && a.y < h && b.x >= 0 && b.y >= 0 && b.x < w && b.y < h);
      assert.ok(a.x !== b.x || a.y !== b.y, `${w}x${h} dir ${dir}: exits apart`);
    }
  }
});

test('progress runs 0 at the entry to 1 at the exit and stays inside', () => {
  const [a, b] = corridorExits(1, 12, 20);
  assert.equal(progress(a, b, a.x, a.y), 0);
  assert.equal(progress(a, b, b.x, b.y), 1);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 12; x++) assert.ok(progress(a, b, x, y) >= 0 && progress(a, b, x, y) <= 1);
});

test('every size and direction makes a reachable corridor with both exits open', () => {
  const meadow = parseBiome('meadow', { ground: { grass: 1 }, obstacles: { bush: 1 }, obstacle_density: 0.1, hills: { max: 2, scale: 4, steep: 2 }, lowland: { share: 0.3, terrain: { water: 1 } } });
  const grove = parseBiome('grove', { ground: { moss: 1 }, obstacles: { tree: 1 }, obstacle_density: 0.2, hills: { max: 3, scale: 4, steep: 3 }, lowland: { share: 0.3, terrain: { swamp: 1 } } });
  for (const [w, h] of SIZES) {
    for (const dir of [0, 1, 2]) {
      for (let seed = 1; seed <= 6; seed++) {
        const template = parseTemplate(`c${w}x${h}`, 'corridor', w, h, { obstacle_mult: 0.8 });
        const g = generateField({ template, biomeA: meadow, biomeB: grove, blend: { from: 0, to: 1 }, seed, dir });
        const seen = reachable(g, g.spawn);
        assert.equal(seen.size, g.tiles.filter((t) => t.walkable).length, `${w}x${h} dir ${dir} seed ${seed}`);
        for (const e of g.exits) assert.ok(seen.has(e.y * w + e.x), `${w}x${h} dir ${dir} exit ${e.id}`);
        const first = g.tiles[g.exits[0].y * w + g.exits[0].x].biome, last = g.tiles[g.exits[1].y * w + g.exits[1].x].biome;
        assert.ok(first && last);
      }
    }
  }
});

test('a border takes a template of its travel, picked by the corridor seed; none fitting falls back', () => {
  const t = (name: string, w: number, h: number, travel: string) => parseTemplate(name, 'corridor', w, h, { travel });
  const all = [t('wide_a', 20, 12, 'x'), t('wide_b', 22, 10, 'x'), t('tall_a', 12, 20, 'y')];
  assert.ok(['wide_a', 'wide_b'].includes(corridorTemplate(all, 0, 7, 'old')));
  assert.equal(corridorTemplate(all, 1, 99, 'old'), 'tall_a');
  assert.equal(corridorTemplate(all, 2, 5, 'old'), 'tall_a');
  assert.equal(corridorTemplate([], 0, 5, 'old'), 'old');
  assert.deepEqual(findCorridorProblems(all), []);
  assert.equal(findCorridorProblems([t('only_x', 20, 12, 'x')]).length, 1);
});
