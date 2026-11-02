-- Display names for the fowl tree, the rooster and its parts (one line each).
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('move_name_flutter', 'Flutter'), ('move_name_claw_kick', 'Claw Kick'), ('move_name_squawk', 'Squawk'),
  ('move_name_triple_peck', 'Triple Peck'), ('move_name_eye_peck', 'Eye Peck'), ('move_name_grain_snack', 'Grain Snack'),
  ('move_name_wing_buffet', 'Wing Buffet'), ('move_name_dust_bath', 'Dust Bath'), ('move_name_flutter_back', 'Flutter Back'),
  ('move_name_talon_rake', 'Talon Rake'), ('move_name_hop_kick', 'Hop Kick'), ('move_name_puff_up', 'Puff Up'),
  ('move_name_alarm_cry', 'Alarm Cry'), ('move_name_peck_flurry', 'Peck Flurry'), ('move_name_skull_peck', 'Skull Peck'),
  ('move_name_gale_wings', 'Gale Wings'), ('move_name_feather_storm', 'Feather Storm'), ('move_name_spur_strike', 'Spur Strike'),
  ('move_name_flying_kick', 'Flying Kick'), ('move_name_dawn_crow', 'Dawn Crow'), ('move_name_peck_storm', 'Peck Storm'),
  ('move_name_spur_fury', 'Spur Fury'), ('move_name_roosters_challenge', 'Rooster''s Challenge'),
  ('species_name_rooster', 'Rooster'),
  ('item_name_rooster_carcass', 'Rooster carcass'), ('item_name_rooster_spur', 'Rooster spur')
) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
