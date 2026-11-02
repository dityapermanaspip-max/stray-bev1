-- What a player calls a vice of each type, and the lines of a vice fight. No numbers, no hint of hidden rules.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, x.expression, x.text
FROM (VALUES
  ('vice_name_str', 'neutral', 'Wrath'),
  ('vice_name_dex', 'neutral', 'Greed'),
  ('vice_name_int', 'neutral', 'Pride'),
  ('vice_name_end', 'neutral', 'Sloth'),
  ('vice_name_luck', 'neutral', 'Envy'),
  ('vice_name_charm', 'neutral', 'Vanity'),
  ('field.encounter.vice', 'tense', 'The air goes cold and heavy. Something old has found me.'),
  ('field.encounter.vice', 'tense', 'Every creature nearby falls silent at once.'),
  ('field.encounter.vice', 'tense', 'A shape steps out that does not belong to this world.'),
  ('field.encounter.vice', 'tense', 'The ground darkens around a figure that watches me.'),
  ('field.encounter.vice', 'tense', 'This is no beast. It knows my name before I speak.'),
  ('field.encounter.vice', 'tense', 'The rumors were true. It is here.'),
  ('vice.fell', 'grim', 'It breaks apart like ash in the wind.'),
  ('vice.fell', 'grim', 'The weight in the air lifts all at once.'),
  ('vice.fell', 'grim', 'It falls, and the silence after is enormous.'),
  ('vice.fell', 'grim', 'Whatever it was, it is gone for good.'),
  ('vice.fell', 'grim', 'The darkness around it bleeds away into the ground.'),
  ('vice.fell', 'grim', 'It gives one last hollow cry and is no more.'),
  ('key.gained', 'calm', 'Something settles deep inside me, warm and certain.'),
  ('key.gained', 'calm', 'I feel a door somewhere far away begin to answer me.'),
  ('key.gained', 'calm', 'A quiet weight sinks into my soul and stays.'),
  ('key.gained', 'calm', 'I carry something now that no hand can take from me.'),
  ('key.gained', 'calm', 'A shape like a key glows behind my eyes, then fades into me.'),
  ('key.gained', 'calm', 'Part of the way to the centre has opened inside me.')
) AS x(condition_key, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
