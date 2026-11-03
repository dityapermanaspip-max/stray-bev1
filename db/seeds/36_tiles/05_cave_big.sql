-- Tile catalog, third batch (2026-11-03): the cave set and three sets of big obstacles (desert, mossy snow, clean snow).
-- Big obstacles (the *_big sheets, 3 x 3) are landmarks: walk-blocking pieces that also serve as field nodes.
-- Variants of one landmark share a terrain (the mossy and the clean snow set), so the pick by position and weight chooses.
INSERT INTO world.tiles (tile_key, atlas, terrain, biome, walkable, sheet, cell, description)
SELECT x.tile_key, x.atlas, x.terrain, x.biome, x.atlas = 'walk', x.sheet, x.cell, x.description
FROM (VALUES
  -- cave: floors, walls, rocks and what a camper leaves
  ('cave_floor_cracked',  'walk',     'cave_floor',     'cave', 'cave', 0,  'cracked grey rock floor'),
  ('cave_floor_pebbles',  'walk',     'cave_floor',     'cave', 'cave', 1,  'rock floor with loose pebbles'),
  ('cave_floor_wet',      'walk',     'cave_wet',       'cave', 'cave', 2,  'wet rock with shallow puddles'),
  ('cave_wall_corner',    'block',    'cave_wall',      'cave', 'cave', 3,  'cliff wall turning a corner'),
  ('cave_wall_glow',      'block',    'cave_wall',      'cave', 'cave', 4,  'cliff wall with glowing blue veins'),
  ('cave_wall_plain',     'block',    'cave_wall',      'cave', 'cave', 5,  'cliff wall, rough grey stone'),
  ('stalagmites',         'obstacle', 'stalagmite',     'cave', 'cave', 6,  'a cluster of stalagmites'),
  ('stalagmite_tall',     'obstacle', 'stalagmite',     'cave', 'cave', 7,  'one tall stalagmite'),
  ('rockfall',            'obstacle', 'rockfall',       'cave', 'cave', 8,  'fallen boulders'),
  ('cave_bedroll',        'obstacle', 'bedroll',        'cave', 'cave', 9,  'a leather bedroll'),
  ('cave_fire',           'obstacle', 'campfire',       'cave', 'cave', 10, 'a stone fire ring, smoking'),
  ('cave_pool',           'block',    'cave_pool',      'cave', 'cave', 11, 'a still pool in a stone rim'),
  ('cave_moss',           'walk',     'cave_moss',      'cave', 'cave', 12, 'patches of green moss'),
  ('cave_bones',          'walk',     'cave_bones',     'cave', 'cave', 13, 'scattered bones and a skull'),
  ('cave_mouth',          'obstacle', 'cave_mouth',     'cave', 'cave', 14, 'a rock arch, the mouth of a cave'),
  -- big_desert: landmarks in the sand
  ('desert_obelisk',      'obstacle', 'obelisk',        'desert', 'big_desert', 0, 'a sandstone obelisk with carved glyphs'),
  ('desert_rock_stack',   'obstacle', 'rock_stack',     'desert', 'big_desert', 1, 'balanced sandstone boulders'),
  ('desert_cactus',       'obstacle', 'cactus_grove',   'desert', 'big_desert', 2, 'tall cactus and thorn scrub'),
  ('desert_stele',        'obstacle', 'stele',          'desert', 'big_desert', 3, 'a carved stone tablet'),
  ('desert_dino_bones',   'obstacle', 'giant_bones',    'desert', 'big_desert', 4, 'the skeleton of a huge beast'),
  ('desert_dead_tree',    'obstacle', 'dead_tree_big',  'desert', 'big_desert', 5, 'a bleached dead tree'),
  ('desert_black_crystal','obstacle', 'crystal_black',  'desert', 'big_desert', 6, 'black crystal spires'),
  ('desert_white_crystal','obstacle', 'crystal_white',  'desert', 'big_desert', 7, 'pale crystal cluster'),
  ('desert_wreck',        'obstacle', 'wreck',          'desert', 'big_desert', 8, 'a wrecked longship in the sand'),
  -- big_snow_moss and big_snow: landmarks in the cold, one weathered and one frozen (same terrains, picked by weight)
  ('snow_obelisk_moss',   'obstacle', 'obelisk',        'snow', 'big_snow_moss', 0, 'a cracked stone obelisk, frost and moss'),
  ('snow_cairn_moss',     'obstacle', 'cairn',          'snow', 'big_snow_moss', 1, 'a mossy stacked cairn'),
  ('snow_grove_moss',     'obstacle', 'frost_grove',    'snow', 'big_snow_moss', 2, 'twisted frosted pines'),
  ('snow_runestone_moss', 'obstacle', 'runestone',      'snow', 'big_snow_moss', 3, 'a rune stone with moss'),
  ('snow_mammoth_moss',   'obstacle', 'giant_bones',    'snow', 'big_snow_moss', 4, 'a mammoth skeleton in the lichen'),
  ('snow_tree_moss',      'obstacle', 'frost_tree',     'snow', 'big_snow_moss', 5, 'a frosted old tree with roots'),
  ('snow_vent_ruin',      'obstacle', 'steam_vent',     'snow', 'big_snow_moss', 6, 'a steaming vent in ruined walls'),
  ('snow_crystal_moss',   'obstacle', 'ice_crystal',    'snow', 'big_snow_moss', 7, 'ice crystals among lichen'),
  ('snow_wreck_moss',     'obstacle', 'wreck',          'snow', 'big_snow_moss', 8, 'a carved longship wreck with a helm'),
  ('snow_ice_spire',      'obstacle', 'ice_spire',      'snow', 'big_snow', 0, 'a tall spire of blue ice'),
  ('snow_cairn',          'obstacle', 'cairn',          'snow', 'big_snow', 1, 'a snowy stacked cairn'),
  ('snow_grove',          'obstacle', 'frost_grove',    'snow', 'big_snow', 2, 'snow-laden twisted pines'),
  ('snow_runestone',      'obstacle', 'runestone',      'snow', 'big_snow', 3, 'a rune stone in the snow'),
  ('snow_mammoth',        'obstacle', 'giant_bones',    'snow', 'big_snow', 4, 'a mammoth skeleton under frost'),
  ('snow_tree',           'obstacle', 'frost_tree',     'snow', 'big_snow', 5, 'an old tree heavy with snow'),
  ('snow_vent',           'obstacle', 'steam_vent',     'snow', 'big_snow', 6, 'a steaming rock vent in ice'),
  ('snow_crystal',        'obstacle', 'ice_crystal',    'snow', 'big_snow', 7, 'ice crystals in the snow'),
  ('snow_wreck',          'obstacle', 'wreck',          'snow', 'big_snow', 8, 'an iced longship wreck')
) AS x(tile_key, atlas, terrain, biome, sheet, cell, description)
ON CONFLICT DO NOTHING;

-- The cave room: rock floor and walls, rocks, a bedroll and a fire by the rest seat.
UPDATE config.balance_config SET value = value
  || jsonb_build_object('rooms', (value->'rooms')
  || jsonb_build_object('cave', (value->'rooms'->'cave') || '{"props":[
       {"terrain":"stalagmite","x":2,"y":2},{"terrain":"stalagmite","x":7,"y":4},{"terrain":"rockfall","x":6,"y":2},
       {"terrain":"bedroll","x":3,"y":3},{"terrain":"campfire","x":5,"y":3}]}'::jsonb))
WHERE config_key = 'interior';
