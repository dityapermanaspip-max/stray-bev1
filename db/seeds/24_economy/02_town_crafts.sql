-- Craftsmen and the dev town's economy (Step 3b). Fee = half the base value a craft adds, at least 1 copper:
-- grilling chicken 3 -> 7 costs 2, splitting a log 3 -> 2 sticks (4) costs 1, carving 3 logs (9) into a club (15) costs 3.
INSERT INTO item.crafts (craft_name, craftsman, output_item_id, output_qty, inputs)
SELECT x.craft_name, x.craftsman, i.id, x.output_qty, x.inputs::jsonb
FROM (VALUES
  ('grill_chicken', 'cook', 'grilled_chicken', 1, '[{"item":"chicken_meat","qty":1}]'),
  ('grill_lizard', 'cook', 'grilled_lizard', 1, '[{"item":"lizard_meat","qty":1}]'),
  ('grill_cat', 'cook', 'grilled_cat', 1, '[{"item":"cat_meat","qty":1}]'),
  ('split_log', 'woodworker', 'oak_stick', 2, '[{"item":"oak_log","qty":1}]'),
  ('carve_club', 'woodworker', 'oak_club', 1, '[{"item":"oak_log","qty":3}]')
) AS x(craft_name, craftsman, output, output_qty, inputs)
JOIN item.items i ON i.item_name = x.output
ON CONFLICT (craft_name) DO NOTHING;

-- The dev town: a village purse, villagers who will not pay more than 100 copper for one thing,
-- and its specialties. Its stock is filled from config the first time the game server opens it.
INSERT INTO world.town_economy (town_ref, purse, max_buy, specialties)
SELECT h.id::text, 3000, 100, '{wood,chicken,lizard,cat}'
FROM world.hexes h JOIN world.rounds r ON r.id = h.round_id AND r.status = 'dev'
WHERE h.field_kind = 'town'
ON CONFLICT (town_ref) DO NOTHING;

-- Two craftsman doors join the square.
UPDATE world.field_templates SET params = jsonb_set(params, '{town,buildings}', '[
  {"service":"inn","w":4,"h":3},{"service":"shop","w":3,"h":3},{"service":"cook","w":3,"h":3},{"service":"woodworker","w":3,"h":3},
  {"service":"temple","w":3,"h":3},{"service":"guild","w":3,"h":3},{"service":"trainer","w":3,"h":3}]'::jsonb)
WHERE template_name = 'town_square';

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'service_name_' || x.service, 0, s.id, 'neutral', x.text
FROM (VALUES ('cook', 'Cook'), ('woodworker', 'Woodworker')) AS x(service, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
