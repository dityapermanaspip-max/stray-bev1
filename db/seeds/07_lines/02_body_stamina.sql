-- Body state: stamina. Tier 1 = spent, tier 5 = fresh. Spoken by the entity.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, x.tier, s.id, x.expression, x.text
FROM (VALUES
  ('body.stamina', 1, 'pained', 'My arms will not lift any more.'),
  ('body.stamina', 1, 'pained', 'I am gasping and my muscles shake.'),
  ('body.stamina', 1, 'pained', 'I have nothing left to give.'),
  ('body.stamina', 1, 'pained', 'My legs feel like wet sand.'),
  ('body.stamina', 1, 'pained', 'I can barely keep my guard up.'),
  ('body.stamina', 1, 'pained', 'My lungs are burning for air.'),
  ('body.stamina', 2, 'tense', 'I am running out of breath fast.'),
  ('body.stamina', 2, 'tense', 'Sweat is stinging my eyes.'),
  ('body.stamina', 2, 'tense', 'Every swing feels heavier than the last.'),
  ('body.stamina', 2, 'tense', 'My heart is pounding in my ears.'),
  ('body.stamina', 2, 'tense', 'I need to slow down soon.'),
  ('body.stamina', 2, 'tense', 'My shoulders are starting to droop.'),
  ('body.stamina', 3, 'neutral', 'I am breathing hard but holding pace.'),
  ('body.stamina', 3, 'neutral', 'My muscles are warm and a little tired.'),
  ('body.stamina', 3, 'neutral', 'I can keep this up for a while yet.'),
  ('body.stamina', 3, 'neutral', 'A short pause would be welcome.'),
  ('body.stamina', 3, 'neutral', 'My rhythm is starting to slip.'),
  ('body.stamina', 3, 'neutral', 'I feel the effort in my legs now.'),
  ('body.stamina', 4, 'neutral', 'I have plenty of strength left.'),
  ('body.stamina', 4, 'neutral', 'My breath is steady.'),
  ('body.stamina', 4, 'neutral', 'Barely winded so far.'),
  ('body.stamina', 4, 'neutral', 'I am loose and moving well.'),
  ('body.stamina', 4, 'neutral', 'My body is warmed up and ready.'),
  ('body.stamina', 4, 'neutral', 'I could go on like this for some time.'),
  ('body.stamina', 5, 'calm', 'I feel fresh and light on my feet.'),
  ('body.stamina', 5, 'calm', 'My energy is bursting to get out.'),
  ('body.stamina', 5, 'calm', 'Not tired in the slightest.'),
  ('body.stamina', 5, 'calm', 'I am fully rested.'),
  ('body.stamina', 5, 'calm', 'My limbs feel springy and eager.'),
  ('body.stamina', 5, 'calm', 'I could run all day.')
) AS x(condition_key, tier, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
