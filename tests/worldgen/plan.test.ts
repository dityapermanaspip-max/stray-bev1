import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fog } from '../../server/map/map_view.ts';
import { createRng } from '../../server/util/rng.ts';
import { hexDistance } from '../../server/world/world_hour.ts';
import { hexesWithin, planWorld } from '../../server/worldgen/plan.ts';
import { cfg } from '../fixtures/battle_data.ts';

const plan = (seed: number) => planWorld(cfg.worldGen, 4, createRng(seed));

test('4 rings: 61 hexes (1, 6, 12, 18, 24 per ring) and 156 borders', () => {
  const p = plan(7);
  assert.equal(p.hexes.length, 61);
  assert.deepEqual([0, 1, 2, 3, 4].map((r) => p.hexes.filter((h) => h.ring === r).length), [1, 6, 12, 18, 24]);
  assert.equal(p.borders.length, 156);
  for (const b of p.borders) assert.equal(hexDistance(p.hexes[b.a], p.hexes[b.b]), 1);
  assert.equal(new Set(p.borders.map((b) => [b.a, b.b].sort((x, y) => x - y).join('-'))).size, 156); // each pair once
});

test('same seed, same world; another seed, another world', () => {
  assert.deepEqual(plan(42), plan(42));
  assert.notDeepEqual(plan(42).hexes.map((h) => h.biome), plan(43).hexes.map((h) => h.biome));
});

test('towns per ring as configured, never side by side', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const towns = plan(seed).hexes.filter((h) => h.town);
    assert.deepEqual([1, 2, 3, 4].map((r) => towns.filter((t) => t.ring === r).length), [2, 3, 4, 6], `seed ${seed}`);
    for (const a of towns) for (const b of towns) if (a !== b) assert.ok(hexDistance(a, b) >= cfg.worldGen.townSpacing);
    assert.equal(towns.some((t) => t.ring === 0), false);
  }
});

test('biomes: the centre is the volcano, every other hex takes a biome its ring allows', () => {
  for (const seed of [1, 2, 3]) {
    for (const h of plan(seed).hexes) {
      if (h.ring === 0) assert.equal(h.biome, 'volcano');
      else assert.ok(h.biome in cfg.worldGen.biomes.get(h.ring)!, `ring ${h.ring}: ${h.biome}`);
    }
  }
  assert.ok(plan(9).hexes.filter((h) => h.biome === 'seashore').every((h) => h.ring === 4));
});

test('corridors per border stay within 3-7', () => {
  const counts = plan(11).borders.map((b) => b.corridors.length);
  assert.ok(counts.every((n) => n >= 3 && n <= 7));
  assert.ok(new Set(counts).size > 1);
});

test('fog: stood-in hexes are visited, their neighbors and the corridor ends glimpsed, the rest fog', () => {
  const rows = hexesWithin(2).map((h) => ({ id: `${h.q},${h.r}`, q: h.q, r: h.r, visited: h.q === 0 && h.r === 0 }));
  const seen = fog(rows, ['2,-2']);
  assert.equal(seen.get('0,0'), 'visited');
  assert.equal([...seen.values()].filter((s) => s === 'glimpsed').length, 7); // 6 neighbors + one corridor end
  assert.equal(seen.get('2,-2'), 'glimpsed');
  assert.equal(seen.get('-2,0'), 'fog');
});
