-- Field shapes and looks (Step 2a). Fields stay small; the world grows by adding more fields and corridors.
-- Template params: obstacle_mult scales the biome's obstacle density for this shape.
INSERT INTO world.field_templates (template_name, kind, width, height, params) VALUES
('open_field',    'open',     20, 20, '{"obstacle_mult":1}'),
('corridor_path', 'corridor',  8, 20, '{"obstacle_mult":0.8}')
ON CONFLICT (template_name) DO NOTHING;

-- Biome params: ground and obstacles are terrain weights; obstacle_density is the blocked share;
-- hills.max is the highest height level, hills.scale the hill size in tiles. More biomes come per hex later.
INSERT INTO world.biomes (biome_name, params) VALUES
('meadow', '{"ground":{"grass":6,"tall_grass":2,"flowers":1,"dirt":1},"obstacles":{"bush":2,"rock":1},
            "obstacle_density":0.08,"hills":{"max":1,"scale":6}}'),
('grove',  '{"ground":{"grass":3,"moss":2,"dirt":2,"leaves":2},"obstacles":{"tree":5,"rock":1,"bush":1},
            "obstacle_density":0.22,"hills":{"max":2,"scale":5}}')
ON CONFLICT (biome_name) DO NOTHING;
