-- Ring 3 display names: species, moves, items (one line each).
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('species_name_ostrich', 'Ostrich'), ('species_name_bull', 'Bull'), ('species_name_bear', 'Bear'),
  ('move_name_charge', 'Charge'), ('move_name_gore', 'Gore'), ('move_name_maul', 'Maul'),
  ('item_name_ostrich_carcass', 'Ostrich carcass'), ('item_name_bull_carcass', 'Bull carcass'), ('item_name_bear_carcass', 'Bear carcass'),
  ('item_name_ostrich_meat', 'Ostrich meat'), ('item_name_beef', 'Beef'), ('item_name_bear_meat', 'Bear meat'),
  ('item_name_ostrich_plume', 'Ostrich plume'), ('item_name_bull_hide', 'Bull hide'), ('item_name_bull_horn', 'Bull horn'),
  ('item_name_bear_pelt', 'Bear pelt'), ('item_name_bear_claw', 'Bear claw'), ('item_name_bear_fat', 'Bear fat')
) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
