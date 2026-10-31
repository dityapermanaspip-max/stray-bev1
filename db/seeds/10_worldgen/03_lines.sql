-- World map: one display name per biome (name keys hold exactly one line).
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('biome_name_meadow', 'Meadow'),
  ('biome_name_grove', 'Grove'),
  ('biome_name_desert', 'Desert'),
  ('biome_name_snow', 'Snowfield'),
  ('biome_name_volcano', 'Volcano'),
  ('biome_name_battlefield', 'Old battlefield'),
  ('biome_name_seashore', 'Seashore')
) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
