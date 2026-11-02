-- Refusal when a formation request names a place that does not exist (not in town reuses loadout.not_here).
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, x.expression, x.text
FROM (VALUES
  ('formation.bad_slot', 'confused', 'There is no such place to stand in a fight.'),
  ('formation.bad_slot', 'confused', 'I cannot stand there; it is nowhere.'),
  ('formation.bad_slot', 'confused', 'That spot is not in any line I know.'),
  ('formation.bad_slot', 'confused', 'Where would that even be?'),
  ('formation.bad_slot', 'confused', 'No line has room for me there.'),
  ('formation.bad_slot', 'confused', 'I try to picture it and cannot.')
) AS x(condition_key, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
