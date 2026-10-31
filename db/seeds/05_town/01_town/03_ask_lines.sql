-- Every change of place asks first: the player's thought before going in at a door (the place name shows with it)
-- and before leaving the field they stand in. Yes / no only; nothing happens on no.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, x.expression, x.text
FROM (VALUES
  ('ask.door', 'neutral', 'Should I go in?'),
  ('ask.door', 'neutral', 'The door is right here. Step inside?'),
  ('ask.door', 'neutral', 'I could look in for a moment.'),
  ('ask.door', 'neutral', 'Do I have business in here?'),
  ('ask.door', 'neutral', 'Warm light behind the door. Go in?'),
  ('ask.door', 'neutral', 'I stop at the doorstep. In, or not?'),
  ('ask.exit', 'thinking', 'Leave this place behind and walk on?'),
  ('ask.exit', 'thinking', 'The path goes on from here. Do I follow it?'),
  ('ask.exit', 'thinking', 'Once I go, there is no telling what waits ahead. Go?'),
  ('ask.exit', 'thinking', 'Am I ready to move on?'),
  ('ask.exit', 'thinking', 'One more step and I am out of here. Take it?'),
  ('ask.exit', 'thinking', 'Should I keep going, or stay a while?')
) AS x(condition_key, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
