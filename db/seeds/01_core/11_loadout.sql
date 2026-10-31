-- Epiphany lines for combo unlocks (several moves practiced together). Vague, no move names, no numbers.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'surprised', x.text
FROM (VALUES
  ('epiphany_combo', 'Two habits of mine just met halfway.'),
  ('epiphany_combo', 'What I learned apart suddenly fits together.'),
  ('epiphany_combo', 'Separate lessons fold into one motion.'),
  ('epiphany_combo', 'My body found a bridge between old tricks.'),
  ('epiphany_combo', 'Something new grows where my skills overlap.'),
  ('epiphany_combo', 'I see how those two things were always one.')
) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
