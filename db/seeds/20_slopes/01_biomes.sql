-- Heights 0-3, slopes, lowland water (Step 2c+). A step may rise one level; two or more needs a slope.
-- hills.max: highest level; hills.steep: contrast (1 rolling, higher gives plateaus and cliffs). lowland.share: part of height-0 ground under water or swamp (blocked), in clumps.
-- slope_share: part of cliff edges that get a slope by chance; more are added wherever a field would be cut off.
UPDATE world.biomes SET params = params || '{"hills":{"max":2,"scale":4,"steep":2.5},"lowland":{"share":0.35,"terrain":{"water":1}},"slope_share":0.5}'
WHERE biome_name = 'meadow';
UPDATE world.biomes SET params = params || '{"hills":{"max":3,"scale":4,"steep":3.5},"lowland":{"share":0.4,"terrain":{"swamp":2,"water":1}},"slope_share":0.3}'
WHERE biome_name = 'grove';
