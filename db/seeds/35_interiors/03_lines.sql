-- Names (one line each), the question before going into a camp or cave, the greeting of an NPC, the talk menu words.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, x.expression, x.text
FROM (VALUES
  ('node_name_camp', 'neutral', 'Old campfire'), ('node_name_cave', 'neutral', 'Cave mouth'),
  ('service_name_camp', 'neutral', 'Campfire'), ('service_name_cave', 'neutral', 'Cave'),
  ('talk_opt_talk', 'neutral', 'Chat'), ('talk_opt_trade', 'neutral', 'Trade'), ('talk_opt_rest', 'neutral', 'Rest'),
  ('talk_opt_gift', 'neutral', 'Give a gift'), ('talk_opt_hire', 'neutral', 'Hire'), ('talk_opt_recruit', 'neutral', 'Ask to join'),
  ('talk_opt_pay', 'neutral', 'Pay wage'), ('talk_opt_dismiss', 'neutral', 'Part ways'), ('talk_opt_leave', 'neutral', 'Leave'),
  ('ask.wild', 'neutral', 'A place to rest. Go in?'),
  ('ask.wild', 'neutral', 'Ashes still warm. Settle here for a while?'),
  ('ask.wild', 'neutral', 'Shelter, of a kind. Step in?'),
  ('ask.wild', 'neutral', 'Nobody about. I could rest here.'),
  ('ask.wild', 'neutral', 'A quiet corner of the wilds. Go in?'),
  ('ask.wild', 'neutral', 'I could catch my breath in there.'),
  ('wild.rested', 'calm', 'The fire burns low, and I sleep lightly but well.'),
  ('wild.rested', 'calm', 'Hard ground, a thin blanket, and still I wake mended.'),
  ('wild.rested', 'calm', 'A few quiet hours. My body thanks me for them.'),
  ('wild.rested', 'calm', 'I wake with the dawn and the aches have eased.'),
  ('wild.rested', 'calm', 'Rest finds me here, in the middle of nowhere.'),
  ('wild.rested', 'calm', 'I sleep with one ear open, and wake able to go on.'),
  ('npc.greet', 'neutral', 'They look up as I come near.'),
  ('npc.greet', 'neutral', 'A nod of greeting. What can I do for you, they ask.'),
  ('npc.greet', 'neutral', 'They turn to me, waiting.'),
  ('npc.greet', 'neutral', 'Eyes follow me across the room.'),
  ('npc.greet', 'neutral', 'They set down what they were doing and face me.'),
  ('npc.greet', 'neutral', 'Well, then. Say your piece.')
) AS x(condition_key, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
