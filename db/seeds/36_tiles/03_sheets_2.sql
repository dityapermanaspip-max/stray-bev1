-- Tile catalog, second batch (2026-11-03): furniture, training ground, temple, water edges, camp, market (two bases).
-- The water edge pieces carry an edge: a water tile with grass on its `ul` side (shore, edge_of grass) and a grass tile with
-- water on its `lr` side (bank). A mirror row is the flipped picture and swaps the grid axes: ul -> ur, lr -> ll.
-- Only these sides have art so far; the other sides need their own pictures (they cannot be made by mirroring).
INSERT INTO world.tiles (tile_key, atlas, terrain, biome, walkable, sheet, cell, description)
SELECT x.tile_key, x.atlas, x.terrain, x.biome, x.atlas = 'walk', x.sheet, x.cell, x.description
FROM (VALUES
  -- furniture: shop and inn (every tile stands on wooden planks)
  ('counter_straight',    'obstacle', 'counter',        'interior', 'furniture', 0,  'straight shop counter'),
  ('counter_end',         'obstacle', 'counter_end',    'interior', 'furniture', 1,  'counter with a rounded end'),
  ('counter_corner',      'obstacle', 'counter_corner', 'interior', 'furniture', 2,  'counter turning a corner'),
  ('shelf_jars',          'obstacle', 'shelf',          'interior', 'furniture', 3,  'shelf with jars and cloth'),
  ('shelf_bottles',       'obstacle', 'shelf',          'interior', 'furniture', 4,  'shelf with potion bottles'),
  ('table_round',         'obstacle', 'table',          'interior', 'furniture', 5,  'round table with a mug'),
  ('table_long',          'obstacle', 'table',          'interior', 'furniture', 6,  'long table with bread and a candle'),
  ('stool',               'obstacle', 'stool',          'interior', 'furniture', 7,  'wooden stool'),
  ('chair',               'obstacle', 'chair',          'interior', 'furniture', 8,  'wooden chair'),
  ('barrel',              'obstacle', 'barrel',         'interior', 'furniture', 9,  'oak barrel'),
  ('crates',              'obstacle', 'crate',          'interior', 'furniture', 10, 'three stacked crates'),
  ('sacks',               'obstacle', 'sacks',          'interior', 'furniture', 11, 'burlap sacks'),
  ('bed_single',          'obstacle', 'bed',            'interior', 'furniture', 12, 'single bed'),
  ('bed_double',          'obstacle', 'bed',            'interior', 'furniture', 13, 'double bed with a quilt'),
  ('bar_rack',            'obstacle', 'bar_rack',       'interior', 'furniture', 14, 'mug rack and a keg'),
  -- training ground (sand)
  ('weapon_rack',         'obstacle', 'rack',           'training', 'training', 0,  'weapon rack'),
  ('armour_stand',        'obstacle', 'armour_stand',   'training', 'training', 1,  'armour on a stand'),
  ('dummy_cloth',         'obstacle', 'dummy',          'training', 'training', 2,  'padded training dummy'),
  ('dummy_straw',         'obstacle', 'dummy',          'training', 'training', 3,  'straw dummy, damaged'),
  ('archery_target',      'obstacle', 'target',         'training', 'training', 4,  'archery target'),
  ('hay_bale',            'obstacle', 'hay_bale',       'training', 'training', 5,  'hay bale'),
  ('sand_floor_raked',    'walk',     'sand_floor',     'training', 'training', 6,  'raked sand'),
  ('sand_floor_prints',   'walk',     'sand_floor',     'training', 'training', 7,  'sand with footprints'),
  ('sand_floor_straw',    'walk',     'sand_edge',      'training', 'training', 8,  'sand with a straw border'),
  ('ring_rope_straight',  'obstacle', 'ring_rope',      'training', 'training', 9,  'sparring ring rope, straight'),
  ('ring_rope_corner',    'obstacle', 'ring_rope',      'training', 'training', 10, 'sparring ring rope, corner'),
  ('notice_board',        'obstacle', 'notice_board',   'training', 'training', 11, 'notice board'),
  ('bench',               'obstacle', 'bench',          'training', 'training', 12, 'long low bench'),
  ('water_bucket',        'obstacle', 'bucket',         'training', 'training', 13, 'bucket of water'),
  ('banner_stand',        'obstacle', 'banner',         'training', 'training', 14, 'banner of crossed swords'),
  -- temple and guild hall
  ('altar',               'obstacle', 'altar',          'temple', 'temple', 0,  'altar with a white cloth'),
  ('altar_candles',       'obstacle', 'altar',          'temple', 'temple', 1,  'altar with candles'),
  ('pew',                 'obstacle', 'pew',            'temple', 'temple', 2,  'church bench'),
  ('saint_statue',        'obstacle', 'saint',          'temple', 'temple', 3,  'robed stone saint'),
  ('holy_font',           'obstacle', 'font',           'temple', 'temple', 4,  'water font'),
  ('floor_sigil',         'walk',     'floor_sigil',    'temple', 'temple', 5,  'marble with a gold sun'),
  ('wall_glass',          'block',    'wall_glass',     'temple', 'temple', 6,  'stone wall with stained glass'),
  ('incense_burner',      'obstacle', 'incense',        'temple', 'temple', 7,  'brass incense burner'),
  ('quest_board',         'obstacle', 'quest_board',    'temple', 'temple', 8,  'board of notices'),
  ('guild_desk',          'obstacle', 'guild_desk',     'temple', 'temple', 9,  'desk with a ledger'),
  ('bookshelf',           'obstacle', 'bookshelf',      'temple', 'temple', 10, 'tall bookshelf'),
  ('map_table',           'obstacle', 'map_table',      'temple', 'temple', 11, 'table with a map'),
  ('trophy_case',         'obstacle', 'trophy',         'temple', 'temple', 12, 'glass case with cups'),
  ('chest',               'obstacle', 'chest',          'temple', 'temple', 13, 'iron-bound chest'),
  ('crystal_stand',       'obstacle', 'crystal_stand',  'temple', 'temple', 14, 'crystal ball on a stand'),
  -- water edges
  ('shore_a',             'block',    'water',          'any', 'water_edges', 0,  'grass on the ul side, water elsewhere'),
  ('shore_b',             'block',    'water',          'any', 'water_edges', 1,  'grass on the ul side, a little different'),
  ('shore_corner',        'block',    'water',          'any', 'water_edges', 2,  'grass in the top corner only'),
  ('shore_reeds',         'block',    'water',          'any', 'water_edges', 3,  'grass on the ul side with reeds'),
  ('bank_straight',       'walk',     'grass',          'any', 'water_edges', 4,  'grass with an earth bank on the lr side'),
  ('bank_island',         'walk',     'bank_island',    'any', 'water_edges', 5,  'a grass block in the water'),
  ('bank_notch',          'walk',     'bank_notch',     'any', 'water_edges', 6,  'grass with a bank cut at one corner'),
  ('water_plain',         'block',    'water',          'any', 'water_edges', 7,  'calm water'),
  ('water_ripples',       'block',    'water',          'any', 'water_edges', 8,  'water with ripples'),
  ('water_deep',          'block',    'water_deep',     'any', 'water_edges', 9,  'deep dark water'),
  ('stepping_stones',     'walk',     'ford',           'any', 'water_edges', 10, 'stones across shallow water'),
  ('pier_straight',       'walk',     'pier',           'any', 'water_edges', 11, 'wooden pier'),
  ('pier_end',            'walk',     'pier',           'any', 'water_edges', 12, 'end of a pier'),
  ('water_reeds',         'block',    'water_reeds',    'any', 'water_edges', 13, 'water with reeds and cattails'),
  ('water_lilies',        'block',    'water_lilies',   'any', 'water_edges', 14, 'water with lilies'),
  -- wild camp (grass)
  ('camp_fire_logs',      'obstacle', 'campfire',       'camp', 'camp', 0,  'campfire with log seats'),
  ('camp_fire_out',       'obstacle', 'campfire_out',   'camp', 'camp', 1,  'burnt-out campfire'),
  ('camp_log',            'obstacle', 'log',            'camp', 'camp', 2,  'a log seat'),
  ('camp_woodpile',       'obstacle', 'woodpile',       'camp', 'camp', 3,  'firewood and an axe in a stump'),
  ('camp_lean_to',        'obstacle', 'lean_to',        'camp', 'camp', 4,  'lean-to of branches'),
  ('camp_tent',           'obstacle', 'tent',           'camp', 'camp', 5,  'green canvas tent'),
  ('camp_bedroll',        'obstacle', 'bedroll',        'camp', 'camp', 6,  'bedroll with a red blanket'),
  ('camp_cook_pot',       'obstacle', 'cook_pot',       'camp', 'camp', 7,  'pot on a tripod over a fire'),
  ('camp_drying_rack',    'obstacle', 'drying_rack',    'camp', 'camp', 8,  'rack of meat and fish'),
  ('camp_ground_grass',   'walk',     'camp_ground',    'camp', 'camp', 9,  'trampled grass'),
  ('camp_ground_dirt',    'walk',     'camp_dirt',      'camp', 'camp', 10, 'trampled dirt'),
  ('camp_ground_snow',    'walk',     'camp_snow',      'camp', 'camp', 11, 'trampled snow'),
  ('camp_trees',          'block',    'camp_trees',     'camp', 'camp', 12, 'dense pine trees'),
  ('camp_bushes',         'block',    'camp_trees',     'camp', 'camp', 13, 'berry bushes'),
  ('camp_marker',         'obstacle', 'camp_marker',    'camp', 'camp', 14, 'an old fire ring on grass'),
  -- market and street, on dirt (yard) and on grass (meadow)
  ('stall_dirt',          'obstacle', 'stall',          'yard', 'market_dirt', 0,  'market stall'),
  ('stall_fruit_dirt',    'obstacle', 'stall',          'yard', 'market_dirt', 1,  'stall with fruit crates'),
  ('stall_cloth_dirt',    'obstacle', 'stall',          'yard', 'market_dirt', 2,  'stall with cloth'),
  ('cart_dirt',           'obstacle', 'cart',           'yard', 'market_dirt', 3,  'handcart of straw'),
  ('fountain_dirt',       'obstacle', 'fountain',       'yard', 'market_dirt', 4,  'stone fountain'),
  ('statue_dirt',         'obstacle', 'statue',         'yard', 'market_dirt', 5,  'hooded statue'),
  ('signpost_dirt',       'obstacle', 'signpost',       'yard', 'market_dirt', 6,  'signpost'),
  ('lamp_dirt',           'obstacle', 'lamp',           'yard', 'market_dirt', 7,  'lamp post'),
  ('hedge_dirt',          'block',    'hedge',          'yard', 'market_dirt', 8,  'trimmed hedges'),
  ('fence_dirt',          'block',    'fence',          'yard', 'market_dirt', 9,  'wooden fence'),
  ('fence_corner_dirt',   'block',    'fence',          'yard', 'market_dirt', 10, 'fence corner'),
  ('gate_dirt',           'obstacle', 'gate',           'yard', 'market_dirt', 11, 'wooden gate'),
  ('flower_bed_dirt',     'obstacle', 'flower_bed',     'yard', 'market_dirt', 12, 'flower bed'),
  ('road_dirt',           'walk',     'road_straight',  'yard', 'market_dirt', 13, 'cobbled road, straight'),
  ('road_cross_dirt',     'walk',     'road_cross',     'yard', 'market_dirt', 14, 'cobbled road crossing'),
  ('stall_grass',         'obstacle', 'stall',          'meadow', 'market_grass', 0,  'market stall'),
  ('stall_fruit_grass',   'obstacle', 'stall',          'meadow', 'market_grass', 1,  'stall with fruit crates'),
  ('stall_cloth_grass',   'obstacle', 'stall',          'meadow', 'market_grass', 2,  'stall with cloth'),
  ('cart_grass',          'obstacle', 'cart',           'meadow', 'market_grass', 3,  'wheelbarrow of straw'),
  ('fountain_grass',      'obstacle', 'fountain',       'meadow', 'market_grass', 4,  'stone fountain'),
  ('statue_grass',        'obstacle', 'statue',         'meadow', 'market_grass', 5,  'hooded statue'),
  ('signpost_grass',      'obstacle', 'signpost',       'meadow', 'market_grass', 6,  'signpost'),
  ('lamp_grass',          'obstacle', 'lamp',           'meadow', 'market_grass', 7,  'lamp post'),
  ('hedge_grass',         'block',    'hedge',          'meadow', 'market_grass', 8,  'square hedge'),
  ('fence_grass',         'block',    'fence',          'meadow', 'market_grass', 9,  'wooden fence'),
  ('fence_corner_grass',  'block',    'fence',          'meadow', 'market_grass', 10, 'fence corner'),
  ('gate_grass',          'obstacle', 'gate',           'meadow', 'market_grass', 11, 'wooden gate'),
  ('flower_bed_grass',    'obstacle', 'flower_bed',     'meadow', 'market_grass', 12, 'flower bed'),
  ('road_grass',          'walk',     'road_straight',  'meadow', 'market_grass', 13, 'cobbled road, straight'),
  ('road_cross_grass',    'walk',     'road_cross',     'meadow', 'market_grass', 14, 'cobbled road crossing')
) AS x(tile_key, atlas, terrain, biome, sheet, cell, description)
ON CONFLICT DO NOTHING;

-- Edges: shore pieces are water with grass on a side; the bank is grass with water on a side.
UPDATE world.tiles SET edge = 'ul', edge_of = 'grass' WHERE tile_key IN ('shore_a', 'shore_b', 'shore_reeds');
UPDATE world.tiles SET edge = 'top', edge_of = 'grass' WHERE tile_key = 'shore_corner';
UPDATE world.tiles SET edge = 'lr', edge_of = 'water' WHERE tile_key = 'bank_straight';

-- Mirrors: no art of their own, the source flipped (the sides swap: ul -> ur, lr -> ll).
INSERT INTO world.tiles (tile_key, atlas, terrain, biome, walkable, mirror_of, edge, edge_of, description)
SELECT s.tile_key || '_flip', s.atlas, s.terrain, s.biome, s.walkable, s.tile_key,
       CASE s.edge WHEN 'ul' THEN 'ur' WHEN 'lr' THEN 'll' END, s.edge_of, s.description || ' (flipped)'
FROM world.tiles s WHERE s.tile_key IN ('shore_a', 'shore_b', 'shore_reeds', 'bank_straight')
ON CONFLICT DO NOTHING;
INSERT INTO world.tiles (tile_key, atlas, terrain, biome, walkable, mirror_of, description)
SELECT 'counter_end_flip', 'obstacle', 'counter_end', 'interior', false, 'counter_end', 'counter with a rounded end (flipped)'
ON CONFLICT DO NOTHING;
