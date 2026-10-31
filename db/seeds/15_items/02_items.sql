-- Starter items: one shape plus one core material per row. Names live in diegetic_lines (item_name_<item>).
-- data: weight, max_durability (else the material's), default_quality, stack (true = stacks, no durability),
-- wield {weapon_type, power, accuracy, hands, thrown, vs_armor {material tag: bonus}, grants_move},
-- worn {slot (a gear_slots accepts value), armor, punch_power, kick_power}. Armor weight comes from the material.
INSERT INTO item.items (item_name, type, shape, core_material_id, data)
SELECT x.item_name, x.type, x.shape, m.id, x.data::jsonb
FROM (VALUES
  -- weapons
  ('iron_knife',  'weapon', 'knife',  'iron',
   '{"weight":0.5,"wield":{"weapon_type":"knife","power":4,"accuracy":1.05,"hands":1,"grants_move":"knife_stab"}}'),
  ('oak_club',    'weapon', 'club',   'oak',
   '{"weight":2,"wield":{"weapon_type":"club","power":5,"hands":1,"grants_move":"club_swing"}}'),
  ('iron_hammer', 'weapon', 'hammer', 'iron',
   '{"weight":6,"wield":{"weapon_type":"hammer","power":9,"accuracy":0.9,"hands":2,"vs_armor":{"metal":0.1},"grants_move":"hammer_smash"}}'),
  ('iron_sword',  'weapon', 'sword',  'iron',
   '{"weight":3,"wield":{"weapon_type":"sword","power":7,"hands":1,"grants_move":"sword_slash"}}'),
  -- found in the world: improvised, stack
  ('river_stone', 'material', 'stone', 'stone',
   '{"weight":0.5,"stack":true,"default_quality":"improvised","wield":{"weapon_type":"thrown","power":3,"hands":1,"thrown":true,"grants_move":"basic_throw"}}'),
  ('oak_stick',   'material', 'stick', 'oak',
   '{"weight":1,"stack":true,"default_quality":"improvised","wield":{"weapon_type":"club","power":2,"hands":1,"grants_move":"club_swing"}}'),
  -- arrival items (config.arrival_answers)
  ('frying_pan',    'tool', 'frying_pan',    'iron',
   '{"weight":2,"max_durability":80,"default_quality":"improvised","wield":{"weapon_type":"club","power":4,"hands":1,"grants_move":"club_swing"}}'),
  ('letter_opener', 'tool', 'letter_opener', 'steel',
   '{"weight":0.1,"max_durability":40,"default_quality":"improvised","wield":{"weapon_type":"knife","power":2,"hands":1,"grants_move":"knife_stab"}}'),
  ('pocket_knife',  'tool', 'pocket_knife',  'steel',
   '{"weight":0.2,"max_durability":60,"default_quality":"improvised","wield":{"weapon_type":"knife","power":3,"hands":1,"grants_move":"knife_stab"}}'),
  ('backpack',      'tool',     'backpack',     'cloth',   '{"weight":1}'),
  ('water_bottle',  'tool',     'water_bottle', 'plastic', '{"weight":1}'),
  ('blanket',       'material', 'blanket',      'cloth',   '{"weight":1.5}'),
  -- armor: leather and iron sets
  ('leather_cap',      'armor', 'helm',    'leather', '{"worn":{"slot":"head","armor":true}}'),
  ('leather_jerkin',   'armor', 'cuirass', 'leather', '{"worn":{"slot":"body","armor":true}}'),
  ('leather_gloves',   'armor', 'gloves',  'leather', '{"worn":{"slot":"hands","armor":true,"punch_power":1}}'),
  ('leather_trousers', 'armor', 'greaves', 'leather', '{"worn":{"slot":"pants","armor":true}}'),
  ('leather_boots',    'armor', 'boots',   'leather', '{"worn":{"slot":"feet","armor":true,"kick_power":1}}'),
  ('iron_helm',        'armor', 'helm',    'iron',    '{"worn":{"slot":"head","armor":true}}'),
  ('iron_cuirass',     'armor', 'cuirass', 'iron',    '{"worn":{"slot":"body","armor":true}}'),
  ('iron_gauntlets',   'armor', 'gloves',  'iron',    '{"worn":{"slot":"hands","armor":true,"punch_power":3}}'),
  ('iron_greaves',     'armor', 'greaves', 'iron',    '{"worn":{"slot":"pants","armor":true}}'),
  ('iron_boots',       'armor', 'boots',   'iron',    '{"worn":{"slot":"feet","armor":true,"kick_power":2}}'),
  -- accessories
  ('copper_ring', 'accessory', 'ring', 'copper', '{"weight":0.05,"worn":{"slot":"ring"}}')
) AS x(item_name, type, shape, material_name, data)
JOIN item.materials m ON m.material_name = x.material_name
ON CONFLICT (item_name) DO NOTHING;
