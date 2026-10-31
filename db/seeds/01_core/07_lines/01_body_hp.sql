-- Body state: health. Tier 1 = near collapse, tier 5 = unhurt. Spoken by the entity.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, x.tier, s.id, x.expression, x.text
FROM (VALUES
  ('body.hp', 1, 'pained', 'My legs are giving out beneath me.'),
  ('body.hp', 1, 'pained', 'Everything is going dark at the edges.'),
  ('body.hp', 1, 'pained', 'I can taste blood and I can barely stand.'),
  ('body.hp', 1, 'pained', 'One more blow and I will fall.'),
  ('body.hp', 1, 'pained', 'My body is screaming at me to stop.'),
  ('body.hp', 1, 'pained', 'I am hanging on by a thread.'),
  ('body.hp', 2, 'pained', 'I am hurt badly and it shows.'),
  ('body.hp', 2, 'pained', 'Every breath sends a sharp pain through my ribs.'),
  ('body.hp', 2, 'pained', 'My wounds are bleeding through my clothes.'),
  ('body.hp', 2, 'pained', 'I am limping and my grip is weak.'),
  ('body.hp', 2, 'pained', 'I cannot take much more of this.'),
  ('body.hp', 2, 'pained', 'My vision swims whenever I move too fast.'),
  ('body.hp', 3, 'tense', 'I have taken a beating but I can still fight.'),
  ('body.hp', 3, 'tense', 'Bruises are spreading under my skin.'),
  ('body.hp', 3, 'tense', 'My side aches with every step.'),
  ('body.hp', 3, 'tense', 'I am scraped and sore, but standing.'),
  ('body.hp', 3, 'tense', 'Something is cut, but it is not deep.'),
  ('body.hp', 3, 'tense', 'I need to be more careful now.'),
  ('body.hp', 4, 'neutral', 'Just a few scratches so far.'),
  ('body.hp', 4, 'neutral', 'A dull ache, nothing more.'),
  ('body.hp', 4, 'neutral', 'I have been nicked, but it barely stings.'),
  ('body.hp', 4, 'neutral', 'A little sore, still steady on my feet.'),
  ('body.hp', 4, 'neutral', 'Nothing that a night of rest will not fix.'),
  ('body.hp', 4, 'neutral', 'I felt that one, but I am fine.'),
  ('body.hp', 5, 'calm', 'I feel whole and steady.'),
  ('body.hp', 5, 'calm', 'Not a mark on me.'),
  ('body.hp', 5, 'calm', 'My body feels strong and ready.'),
  ('body.hp', 5, 'calm', 'I am in good shape.'),
  ('body.hp', 5, 'calm', 'Nothing hurts at all.'),
  ('body.hp', 5, 'calm', 'I could take on anything right now.')
) AS x(condition_key, tier, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
