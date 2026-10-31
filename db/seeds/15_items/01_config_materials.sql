-- Gear config and core materials (Step 1.7). Example numbers, tune later.

INSERT INTO config.balance_config (config_key, value, description) VALUES
('gear_slots', '[
  {"slot":"main_hand","accepts":"hand","kind":"wield"},
  {"slot":"off_hand","accepts":"hand","kind":"wield"},
  {"slot":"head","accepts":"head","kind":"wear"},
  {"slot":"body","accepts":"body","kind":"wear"},
  {"slot":"hands","accepts":"hands","kind":"wear"},
  {"slot":"pants","accepts":"pants","kind":"wear"},
  {"slot":"feet","accepts":"feet","kind":"wear"},
  {"slot":"neck","accepts":"neck","kind":"adorn"},
  {"slot":"ears","accepts":"ears","kind":"adorn"},
  {"slot":"ring_1","accepts":"ring","kind":"adorn"},
  {"slot":"ring_2","accepts":"ring","kind":"adorn"},
  {"slot":"ring_3","accepts":"ring","kind":"adorn"},
  {"slot":"ring_4","accepts":"ring","kind":"adorn"},
  {"slot":"ring_5","accepts":"ring","kind":"adorn"},
  {"slot":"ring_6","accepts":"ring","kind":"adorn"},
  {"slot":"ring_7","accepts":"ring","kind":"adorn"},
  {"slot":"ring_8","accepts":"ring","kind":"adorn"},
  {"slot":"ring_9","accepts":"ring","kind":"adorn"},
  {"slot":"ring_10","accepts":"ring","kind":"adorn"}
]', 'Gear slots. accepts = what an item must fit; kind picks the equip and unequip lines (wield, wear, adorn).'),
('armor_body_shares', '{"head":0.15,"body":0.35,"hands":0.15,"pants":0.2,"feet":0.15}', 'Share of a full armor set (defense and weight) each armor slot holds.'),
('gear_stack_falloff', '0.5', 'Same effect from several pieces: strongest counts fully, each next one times this again.'),
('gear_wear_floor', '0.5', 'A worn piece works at this share just before it breaks; new = 1, broken = 0.'),
('gear_condition_tiers', '{"thresholds":[0.25,0.5,0.75]}', 'Durability share thresholds for condition tiers 1-4. Broken = 0.'),
('load_light_below', '0.4', 'Load share under this is tier 1 (light). weight_limits sets tiers 3 (slow) and 4 (stuck).'),
('quality.improvised.power_mult', '0.6', 'Improvised weapon power (a frying pan, a stone).')
ON CONFLICT (config_key) DO NOTHING;

-- set_defense and set_weight are for a full armor set; each slot takes its body share.
INSERT INTO item.materials (material_name, tags, data) VALUES
('cloth',   '{cloth}',   '{"set_defense":1.5,"set_weight":4,"durability":30}'),
('leather', '{leather}', '{"set_defense":3,"set_weight":8,"durability":60}'),
('bronze',  '{metal}',   '{"set_defense":5,"set_weight":24,"durability":90}'),
('iron',    '{metal}',   '{"set_defense":7,"set_weight":30,"durability":120}'),
('steel',   '{metal}',   '{"set_defense":10,"set_weight":28,"durability":160}'),
('copper',  '{metal}',   '{"durability":100}'),
('oak',     '{wood}',    '{"durability":50}'),
('stone',   '{stone}',   '{}'),
('plastic', '{plastic}', '{"durability":40}')
ON CONFLICT (material_name) DO NOTHING;
