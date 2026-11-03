import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blendConfig, findBlendProblems } from '../../server/config/blend_config.ts';

const biomes = new Set(['meadow', 'grove', 'desert']);

test('a full, ordered rank has no problems', () => {
  assert.deepEqual(findBlendProblems(blendConfig({ rank: ['meadow', 'grove', 'desert'] }), biomes), []);
});

test('a biome without a rank, an unknown biome and a repeat are reported', () => {
  const problems = findBlendProblems(blendConfig({ rank: ['meadow', 'meadow', 'lava'] }), biomes);
  assert.equal(problems.length, 4);
  assert.ok(problems.some((p) => p.includes('grove has no rank')));
  assert.ok(problems.some((p) => p.includes('unknown biome lava')));
  assert.ok(problems.some((p) => p.includes('meadow listed twice')));
});
