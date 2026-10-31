-- Food (SYSTEMS.md): a luxury, never a hunger meter. One meal at a time; it lasts duration_minutes (times
-- world_time_scale) from when it was eaten, nothing ticks it. Its effect is hidden: never sent to the client.
-- item data meal: stamina_cost / mana_cost multiply what moves cost in battle; standby_regen speeds sitting still
-- (applies once standby regen is built). Tier 1 food barely shows; cooked beats raw.
INSERT INTO config.balance_config (config_key, value, description) VALUES
('food', '{"duration_minutes":30}', 'How long a meal lasts, in real minutes before world_time_scale.')
ON CONFLICT (config_key) DO NOTHING;

UPDATE item.items i SET data = i.data || jsonb_build_object('meal', x.meal::jsonb)
FROM (VALUES
  ('chicken_meat',    '{"stamina_cost":0.98}'), ('grilled_chicken', '{"stamina_cost":0.95}'),
  ('cat_meat',        '{"stamina_cost":0.98}'), ('grilled_cat',     '{"stamina_cost":0.96}'),
  ('lizard_meat',     '{"standby_regen":1.03}'), ('grilled_lizard', '{"standby_regen":1.08}'),
  ('small_fish',      '{"mana_cost":0.98}'),    ('trout',           '{"mana_cost":0.96}'),
  ('gloomcap',        '{"mana_cost":0.95}')
) AS x(item_name, meal)
WHERE i.item_name = x.item_name;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, x.expression, x.text
FROM (VALUES
  ('food.start', 'pleased', 'That hit the spot.'),
  ('food.start', 'pleased', 'Better. Much better.'),
  ('food.start', 'pleased', 'Warm in the belly. I feel ready for more.'),
  ('food.start', 'pleased', 'Not a feast, but it will carry me a while.'),
  ('food.start', 'pleased', 'Food makes the road shorter.'),
  ('food.start', 'pleased', 'I did not know how much I needed that.'),
  ('food.end', 'neutral', 'All that exercise used up the meal.'),
  ('food.end', 'neutral', 'That meal is long gone now.'),
  ('food.end', 'neutral', 'My belly reminds me it was a while ago.'),
  ('food.end', 'neutral', 'Whatever I ate has worn off.'),
  ('food.end', 'neutral', 'The meal kept me going this far. No further.'),
  ('food.end', 'neutral', 'I could eat again, if I had something.'),
  ('food.cannot', 'disgusted', 'I am not putting that in my mouth.'),
  ('food.cannot', 'disgusted', 'That is not food. Not anymore, at least.'),
  ('food.cannot', 'disgusted', 'My stomach turns just looking at it.'),
  ('food.cannot', 'disgusted', 'I am hungry, but not that hungry.'),
  ('food.cannot', 'disgusted', 'No. Absolutely not.'),
  ('food.cannot', 'disgusted', 'That would do me more harm than good.')
) AS x(condition_key, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
