-- Five more biomes (Step 4): desert, snow, volcano, battlefield (plain grass, war-torn), seashore.
-- Same params as meadow and grove: ground and obstacle terrain weights, obstacle_density (blocked share), hills
-- (max level, scale in tiles, steep contrast), lowland (part of height-0 ground under water, lava, sea... blocked),
-- slope_share. Terrain names are keys the client colours; they are never shown as text.
INSERT INTO world.biomes (biome_name, params) VALUES
('desert', '{"ground":{"sand":6,"dune":2,"cracked_earth":1},"obstacles":{"cactus":2,"rock":2,"dry_bush":1},
  "obstacle_density":0.07,"hills":{"max":2,"scale":6,"steep":1.5},"lowland":{"share":0.06,"terrain":{"water":1}},"slope_share":0.6}'),
('snow', '{"ground":{"snow":6,"frost_grass":2,"ice":1},"obstacles":{"pine":4,"rock":2,"snow_drift":1},
  "obstacle_density":0.18,"hills":{"max":3,"scale":4,"steep":3},"lowland":{"share":0.25,"terrain":{"frozen_lake":1}},"slope_share":0.4}'),
('volcano', '{"ground":{"ash":4,"basalt":3,"scorched":2},"obstacles":{"lava_rock":3,"obsidian":1,"dead_tree":1},
  "obstacle_density":0.15,"hills":{"max":3,"scale":3,"steep":4},"lowland":{"share":0.3,"terrain":{"lava":1}},"slope_share":0.3}'),
('battlefield', '{"ground":{"grass":5,"trampled":3,"mud":1},"obstacles":{"wreck":2,"stakes":2,"rock":1},
  "obstacle_density":0.06,"hills":{"max":1,"scale":7,"steep":1.2},"lowland":{"share":0.1,"terrain":{"water":1}},"slope_share":0.6}'),
('seashore', '{"ground":{"sand":5,"wet_sand":3,"shingle":2},"obstacles":{"rock":3,"driftwood":2,"dune_grass":1},
  "obstacle_density":0.08,"hills":{"max":1,"scale":6,"steep":1.5},"lowland":{"share":0.5,"terrain":{"sea":1}},"slope_share":0.5}')
ON CONFLICT (biome_name) DO NOTHING;
