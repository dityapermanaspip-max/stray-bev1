-- Step 3c: the dev town's trades. It sits between the meadow (chickens, lizards) and the grove (oaks, cats):
-- a timber and tannery village. Specialties: wood, chicken, lizard, leather. Cat is no longer one: most folk will
-- not eat cat (taboo meat: no shop takes or stocks it; the cook still grills it if asked), but cat pelts tan well.
-- The shop shelf holds finished goods only (gear, tools, and whatever a craftsman makes).

UPDATE config.balance_config SET value = value || '{"shop_sells_types":["weapon","armor","tool","accessory"]}'::jsonb
WHERE config_key = 'economy';

INSERT INTO item.items (item_name, type, shape, core_material_id, data)
VALUES
  ('raw_hide', 'material', 'hide', NULL, '{"weight":1,"stack":true}'),
  ('tanned_leather', 'material', 'sheet', NULL, '{"weight":0.5,"stack":true}')
ON CONFLICT (item_name) DO NOTHING;

UPDATE item.items i SET data = i.data || x.extra::jsonb
FROM (VALUES
  ('cat_meat', '{"taboo":true}'), ('grilled_cat', '{"taboo":true}'),
  ('cat_pelt', '{"goods":["leather"]}'), ('lizard_scale', '{"goods":["lizard","leather"]}'),
  ('raw_hide', '{"value":7,"goods":["leather"]}'), ('tanned_leather', '{"value":5,"goods":["leather"]}'),
  ('leather_cap', '{"goods":["leather"]}'), ('leather_gloves', '{"goods":["leather"]}'), ('leather_boots', '{"goods":["leather"]}'),
  ('leather_trousers', '{"goods":["leather"]}'), ('leather_jerkin', '{"goods":["leather"]}')
) AS x(item_name, extra)
WHERE i.item_name = x.item_name;

-- The tanner. Leather per piece follows the armor body shares (a full set is about 20): cap, gloves, boots 3,
-- trousers 4, jerkin 7. Fees (half the value added): scrape 1, scales 1, tan 3 (hide 7 + log 3 -> 15),
-- cap 3, gloves 2, boots 4, trousers 8, jerkin 5. Trousers and the jerkin need a tanner of level 2.
INSERT INTO item.recipes (recipe_name, facility_type, min_facility_level, inputs, outputs)
VALUES
  ('scrape_pelt', 'tanner', 1, '[{"item":"cat_pelt","qty":1}]', '[{"item":"raw_hide","qty":1}]'),
  ('scale_hide', 'tanner', 1, '[{"item":"lizard_scale","qty":3}]', '[{"item":"raw_hide","qty":1}]'),
  ('tan_hide', 'tanner', 1, '[{"item":"raw_hide","qty":1},{"item":"oak_log","qty":1}]', '[{"item":"tanned_leather","qty":3}]'),
  ('sew_cap', 'tanner', 1, '[{"item":"tanned_leather","qty":3}]', '[{"item":"leather_cap","qty":1}]'),
  ('sew_gloves', 'tanner', 1, '[{"item":"tanned_leather","qty":3}]', '[{"item":"leather_gloves","qty":1}]'),
  ('sew_boots', 'tanner', 1, '[{"item":"tanned_leather","qty":3}]', '[{"item":"leather_boots","qty":1}]'),
  ('sew_trousers', 'tanner', 2, '[{"item":"tanned_leather","qty":4}]', '[{"item":"leather_trousers","qty":1}]'),
  ('sew_jerkin', 'tanner', 2, '[{"item":"tanned_leather","qty":7}]', '[{"item":"leather_jerkin","qty":1}]')
ON CONFLICT (recipe_name) DO NOTHING;

-- The dev town: new specialties, a level 2 tanner, and its stock refilled from config for them.
UPDATE world.town_economy e SET specialties = '{wood,chicken,lizard,leather}', facilities = '{"tanner":2}'::jsonb
FROM world.hexes h JOIN world.rounds r ON r.id = h.round_id AND r.status = 'dev'
WHERE h.field_kind = 'town' AND e.town_ref = h.id::text;

DELETE FROM world.town_stock s USING world.hexes h JOIN world.rounds r ON r.id = h.round_id AND r.status = 'dev'
WHERE h.field_kind = 'town' AND s.town_ref = h.id::text;

-- The tanner's door joins the square (8 buildings fill it).
UPDATE world.field_templates SET params = jsonb_set(params, '{town,buildings}', params->'town'->'buildings' || '[{"service":"tanner","w":3,"h":3}]'::jsonb)
WHERE template_name = 'town_square' AND NOT (params->'town'->'buildings' @> '[{"service":"tanner"}]'::jsonb);

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('service_name_tanner', 'Tanner'), ('item_name_raw_hide', 'Raw hide'), ('item_name_tanned_leather', 'Tanned leather')
) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
