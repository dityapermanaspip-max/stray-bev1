-- Body state: mana. Tier 1 = drained, tier 5 = brimming. Spoken by the entity.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, x.tier, s.id, x.expression, x.text
FROM (VALUES
  ('body.mana', 1, 'pained', 'The well inside me has run dry.'),
  ('body.mana', 1, 'pained', 'My head throbs and my thoughts scatter.'),
  ('body.mana', 1, 'pained', 'I reach for power and find nothing.'),
  ('body.mana', 1, 'pained', 'A cold emptiness sits behind my eyes.'),
  ('body.mana', 1, 'pained', 'My fingertips have gone numb and dull.'),
  ('body.mana', 1, 'pained', 'I could not light a candle right now.'),
  ('body.mana', 2, 'tense', 'Only a trickle of power is left in me.'),
  ('body.mana', 2, 'tense', 'My focus keeps slipping away.'),
  ('body.mana', 2, 'tense', 'A headache is building behind my brow.'),
  ('body.mana', 2, 'tense', 'I must spend what remains carefully.'),
  ('body.mana', 2, 'tense', 'The hum inside me has gone faint.'),
  ('body.mana', 2, 'tense', 'My hands tremble when I call on it.'),
  ('body.mana', 3, 'neutral', 'I have spent a fair share of my power.'),
  ('body.mana', 3, 'neutral', 'The current inside me runs steady but thin.'),
  ('body.mana', 3, 'neutral', 'I feel a mild pressure behind my eyes.'),
  ('body.mana', 3, 'neutral', 'There is still something left to draw on.'),
  ('body.mana', 3, 'neutral', 'My mind is tired but clear.'),
  ('body.mana', 3, 'neutral', 'I should not waste what I have.'),
  ('body.mana', 4, 'neutral', 'My power flows easily.'),
  ('body.mana', 4, 'neutral', 'A gentle warmth hums in my chest.'),
  ('body.mana', 4, 'neutral', 'My thoughts are sharp and ready.'),
  ('body.mana', 4, 'neutral', 'I have barely touched my reserves.'),
  ('body.mana', 4, 'neutral', 'The current answers when I call.'),
  ('body.mana', 4, 'neutral', 'I feel focused and in control.'),
  ('body.mana', 5, 'calm', 'Power is brimming at my fingertips.'),
  ('body.mana', 5, 'calm', 'My mind is calm and full.'),
  ('body.mana', 5, 'calm', 'I feel a bright hum all through me.'),
  ('body.mana', 5, 'calm', 'The well inside me is full.'),
  ('body.mana', 5, 'calm', 'Everything feels clear and charged.'),
  ('body.mana', 5, 'calm', 'I could shape the air itself right now.')
) AS x(condition_key, tier, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
