-- Town economy (Step 3b): a base price (copper) for every traded item and its goods family for town
-- specialties. Base price = what a town at half stock asks. New goods: oak logs and grilled meats.

INSERT INTO config.balance_config (config_key, value, description) VALUES
('economy', '{"price_empty_mult":2,"price_full_mult":0.5,"shop_buy_share":0.7,
  "capacity":{"food":40,"part":60,"material":40,"carcass":12,"weapon":3,"armor":3,"tool":4,"accessory":2,"essence":20},
  "specialty":{"capacity_mult":3,"start_fill":0.6},"start_fill":0.35,
  "quality_value":{"improvised":0.5,"crude":0.6,"common":1,"fine":1.6,"masterwork":3},
  "craft":{"fee_share":0.5,"min_fee":1}}',
 'Town prices follow stock (x2 empty, x1 at half capacity, x0.5 full); shop buys at 70% of its price; capacity per item type, x3 for specialties; craft fee = half the value added.')
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO item.items (item_name, type, shape, core_material_id, data)
SELECT x.item_name, x.type, x.shape, m.id, x.data::jsonb
FROM (VALUES
  ('oak_log', 'material', 'log', 'oak', '{"weight":2,"stack":true}'),
  ('grilled_chicken', 'food', 'meat', NULL, '{"weight":0.4,"edible":true}'),
  ('grilled_lizard', 'food', 'meat', NULL, '{"weight":0.6,"edible":true}'),
  ('grilled_cat', 'food', 'meat', NULL, '{"weight":0.6,"edible":true}')
) AS x(item_name, type, shape, material, data)
LEFT JOIN item.materials m ON m.material_name = x.material
ON CONFLICT (item_name) DO NOTHING;

-- value: base price in copper. goods: trade families a town can specialise in.
UPDATE item.items i SET data = i.data || x.extra::jsonb
FROM (VALUES
  ('chicken_meat', '{"value":3,"goods":["chicken"]}'), ('grilled_chicken', '{"value":7,"goods":["chicken"]}'),
  ('lizard_meat', '{"value":3,"goods":["lizard"]}'), ('grilled_lizard', '{"value":7,"goods":["lizard"]}'),
  ('cat_meat', '{"value":2,"goods":["cat"]}'), ('grilled_cat', '{"value":5,"goods":["cat"]}'),
  ('chicken_carcass', '{"goods":["chicken"]}'), ('lizard_carcass', '{"goods":["lizard"]}'), ('cat_carcass', '{"goods":["cat"]}'),
  ('chicken_feather', '{"goods":["chicken"]}'), ('chicken_beak', '{"goods":["chicken"]}'),
  ('lizard_scale', '{"goods":["lizard"]}'), ('lizard_tail', '{"goods":["lizard"]}'), ('lizard_tooth', '{"goods":["lizard"]}'),
  ('cat_pelt', '{"goods":["cat"]}'), ('cat_claw', '{"goods":["cat"]}'), ('cat_whisker', '{"goods":["cat"]}'),
  ('oak_log', '{"value":3,"goods":["wood"]}'), ('oak_stick', '{"value":2,"goods":["wood"]}'), ('oak_club', '{"value":15,"goods":["wood"]}'),
  ('river_stone', '{"value":1}'), ('blanket', '{"value":8}'),
  ('pocket_knife', '{"value":25}'), ('letter_opener', '{"value":8}'), ('frying_pan', '{"value":20}'),
  ('backpack', '{"value":30}'), ('water_bottle', '{"value":5}'), ('copper_ring', '{"value":30}'),
  ('iron_knife', '{"value":40}'), ('iron_sword', '{"value":120}'), ('iron_hammer', '{"value":150}'),
  ('leather_cap', '{"value":20}'), ('leather_gloves', '{"value":18}'), ('leather_boots', '{"value":22}'),
  ('leather_trousers', '{"value":35}'), ('leather_jerkin', '{"value":45}'),
  ('iron_helm', '{"value":80}'), ('iron_gauntlets', '{"value":70}'), ('iron_boots', '{"value":85}'),
  ('iron_greaves', '{"value":150}'), ('iron_cuirass', '{"value":200}')
) AS x(item_name, extra)
WHERE i.item_name = x.item_name;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'item_name_' || x.item_name, 0, s.id, 'neutral', x.text
FROM (VALUES ('oak_log', 'Oak log'), ('grilled_chicken', 'Grilled chicken'), ('grilled_lizard', 'Grilled lizard'), ('grilled_cat', 'Grilled cat'))
  AS x(item_name, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
