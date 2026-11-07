-- Running away from a battle (hidden numbers): chance = base + speed_slope x (slowest standing party speed / fastest
-- standing enemy speed - 1) + luck_slope x (best party luck / best enemy luck - 1), kept between floor and cap.
INSERT INTO config.balance_config (config_key, value, description) VALUES
('combat.flee', '{"base":0.5,"speed_slope":0.5,"luck_slope":0.15,"floor":0.05,"cap":0.95}',
 'Flee roll: base chance, how far the slowest party member against the fastest enemy moves it (speed_slope), how far the luckiest of each side moves it (luck_slope), floor and cap.')
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, x.expression, x.text
FROM (VALUES
  ('battle.fled', 'relieved', 'We broke away and ran until the sounds faded behind us.'),
  ('battle.fled', 'relieved', 'Not a proud exit, but we are all still breathing.'),
  ('battle.fled', 'relieved', 'We slipped out of reach and did not look back.'),
  ('battle.fled', 'relieved', 'The way opened for a heartbeat, and we took it.'),
  ('battle.flee.fail', 'strained', 'They cut off the way. I cannot get clear.'),
  ('battle.flee.fail', 'strained', 'I stumble, and the gap closes again.'),
  ('battle.flee.fail', 'strained', 'No opening yet. They are too quick.'),
  ('battle.flee.fail', 'strained', 'We try to break away, and fail.'),
  ('battle.flee.boss', 'grim', 'There is nowhere to run in here.'),
  ('battle.flee.boss', 'grim', 'The doors are shut behind us. This ends here.'),
  ('battle.flee.boss', 'grim', 'It will not let us go.')
) AS x(condition_key, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
