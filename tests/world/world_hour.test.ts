import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runHour, type TickWorld } from '../../server/world/world_hour.ts';
import { createRng } from '../../server/util/rng.ts';
import { cfg } from '../fixtures/battle_data.ts';

// What `npm run world:ticks -- --hours N` runs, hour by hour, checked by hand (fixture: birth 2% / 6h, conversion
// 1% / 10h on the outer ring, feeding only above 1.2 x max).
test('running 12 world hours on one outer-ring hex matches the hand math', () => {
  const w = { cfg, catalog: new Map(), loot: { tables: new Map() }, recipes: [], biomes: new Map(), rng: createRng(1) } as unknown as TickWorld;
  const hex = { id: 'h', q: 0, r: 0, ring: cfg.rings.count, biome: null };
  const row = { species: 'cat', natives: 1000, corrupted: 0, safe: 100, max: 10000 };
  const pop = new Map([['h', [row]]]);
  for (let h = 1; h <= 12; h++) runHour(w, [hex], pop, [], h);
  // hour 6: +floor(1000 x 0.02) = 1020; hour 10: 10 turn = 1010 / 10; hour 12: +floor(1010 x 0.02) = 1030
  assert.deepEqual([row.natives, row.corrupted], [1030, 10]);
});
