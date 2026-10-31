import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blendRows, density, encounterPermille, groupLimit, rollEncounter } from '../../server/world/encounter.ts';
import { birth, conversion, feeding, simulate, type PopRow } from '../../server/world/population.ts';
import { createRng } from '../../server/util/rng.ts';
import { cfg } from '../fixtures/battle_data.ts';

const meadow = (): PopRow[] => [
  { species: 'chicken', natives: 1000, corrupted: 0, safe: 200, max: 5000 },
  { species: 'lizard', natives: 2000, corrupted: 0, safe: 400, max: 5000 },
];
const grove = (): PopRow[] => [{ species: 'cat', natives: 2000, corrupted: 1000, safe: 400, max: 10000 }];

test('chance per step follows density, capped at full, and luck lowers it', () => {
  assert.equal(density(meadow()), 0.3);
  assert.equal(encounterPermille(cfg.encounter, cfg.luck, meadow(), 0), 30);
  assert.equal(encounterPermille(cfg.encounter, cfg.luck, meadow(), 5), 25); // one per mille per luck point
  const crowded = [{ species: 'cat', natives: 9000, corrupted: 9000, safe: 0, max: 10000 }];
  assert.equal(encounterPermille(cfg.encounter, cfg.luck, crowded, 0), 100);
  assert.equal(encounterPermille(cfg.encounter, cfg.luck, [], 0), 0);
});

test('quiet fields send single creatures, full ones up to group_max', () => {
  assert.equal(groupLimit(cfg.encounter, meadow()), 1);
  assert.equal(groupLimit(cfg.encounter, [{ species: 'cat', natives: 10000, corrupted: 0, safe: 0, max: 10000 }]), 4);
});

test('species by head count, corrupted by their share', () => {
  const rng = createRng(11);
  const crowded = [{ species: 'cat', natives: 5000, corrupted: 5000, safe: 0, max: 10000 }, ...meadow()];
  let cats = 0;
  let corrupted = 0;
  let foes = 0;
  for (let i = 0; i < 4000; i++) {
    for (const f of rollEncounter(cfg.encounter, cfg.luck, crowded, 0, rng) ?? []) {
      foes++;
      if (f.species === 'cat') cats++;
      if (f.corrupted) corrupted++;
    }
  }
  assert.ok(Math.abs(cats / foes - 10 / 13) < 0.05, `cats ${cats / foes}`);
  assert.ok(Math.abs(corrupted / cats - 0.5) < 0.07, `corrupted ${corrupted / cats}`);
  // 65% density: 65 per mille per step, groups of 1-2, so about 4000 x 0.065 x 1.5 = 390 creatures
  assert.ok(foes > 320 && foes < 460, `foes ${foes}`);
});

test('corridors mix the two hexes by their place in the chain', () => {
  const mid = blendRows(meadow(), grove(), 0.5);
  assert.deepEqual(mid.map((r) => [r.species, r.natives, r.corrupted, r.max]), [
    ['chicken', 500, 0, 2500], ['lizard', 1000, 0, 2500], ['cat', 1000, 500, 5000],
  ]);
});

test('world tick rules: birth capped at max, conversion and feeding stop at the safe floor', () => {
  const r: PopRow = { species: 'cat', natives: 1000, corrupted: 0, safe: 990, max: 1010 };
  birth(cfg.ticks, r);
  assert.equal(r.natives, 1010); // +20 capped at 1010
  conversion(cfg.ticks, r);
  assert.deepEqual([r.natives, r.corrupted], [1000, 10]);
  conversion(cfg.ticks, r);
  assert.deepEqual([r.natives, r.corrupted], [990, 20]); // only 10 above the floor
  const crowded: PopRow = { species: 'cat', natives: 1000, corrupted: 1000, safe: 0, max: 1000 };
  feeding(cfg.ticks, crowded);
  assert.equal(crowded.natives, 950);
  const calm: PopRow = { species: 'cat', natives: 1000, corrupted: 100, safe: 0, max: 1000 };
  feeding(cfg.ticks, calm);
  assert.equal(calm.natives, 1000); // 110% is below the 120% threshold
});

test('a field left alone for 10 days keeps growing (4 births a day, a conversion every 10 hours)', () => {
  const days = simulate(cfg.ticks, 1, meadow(), 10);
  assert.equal(days.length, 10);
  assert.deepEqual(days[0][0], { species: 'chicken', natives: 1060, corrupted: 20, safe: 200, max: 5000 });
  assert.ok(density(days[9]) > 0.55 && density(days[9]) < 0.65, `day 10 density ${density(days[9])}`);
});
