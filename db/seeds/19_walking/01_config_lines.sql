-- Walking in fields (Step 2b). Weight: load tier 3 walks at weight_limits.slow_walk_mult; tier 4 cannot move.
INSERT INTO config.balance_config (config_key, value, description) VALUES
('field.walk', '{"tiles_per_second":3,"max_path":200}', 'Walking speed in tiles per second. max_path caps the steps of one walk order.')
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, x.expression, x.text
FROM (VALUES
  ('field.stuck', 'pained', 'I cannot take another step with all this weight.'),
  ('field.stuck', 'pained', 'My legs refuse to move under this load.'),
  ('field.stuck', 'pained', 'I have to drop something before I can go anywhere.'),
  ('field.stuck', 'pained', 'Too heavy, I am rooted to the spot.'),
  ('field.stuck', 'pained', 'I strain against the load, but I do not move.'),
  ('field.stuck', 'pained', 'Nothing doing, not while I carry this much.'),
  ('field.no_way', 'neutral', 'There is no path beyond this point.'),
  ('field.no_way', 'neutral', 'The way ends here, for now.'),
  ('field.no_way', 'neutral', 'Nothing lies past this edge that I can reach.'),
  ('field.no_way', 'neutral', 'I look out, but there is no road onward.'),
  ('field.no_way', 'neutral', 'This edge leads nowhere I can go.'),
  ('field.no_way', 'neutral', 'The land beyond is closed to me.'),
  ('field.cannot_reach', 'neutral', 'I cannot get there from here.'),
  ('field.cannot_reach', 'neutral', 'Something is in the way.'),
  ('field.cannot_reach', 'neutral', 'There is no way through to that spot.'),
  ('field.cannot_reach', 'neutral', 'That place is out of reach.'),
  ('field.cannot_reach', 'neutral', 'I would have to climb over that, and I cannot.'),
  ('field.cannot_reach', 'neutral', 'No path leads there.')
) AS x(condition_key, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
