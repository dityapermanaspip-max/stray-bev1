-- Tier names (exactly one line each, key favor_name_<tier>), the shopkeeper's tier 4 greetings, and the refusal a
-- shop gives someone the town has turned against. Never numbers.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, x.expression, x.text
FROM (VALUES
  ('favor_name_0', 'neutral', 'Stranger'), ('favor_name_1', 'neutral', 'Acquaintance'), ('favor_name_2', 'neutral', 'Familiar'),
  ('favor_name_3', 'warm', 'Friend'), ('favor_name_4', 'warm', 'Trusted'), ('favor_name_5', 'warm', 'Companion'),
  ('favor_name_6', 'warm', 'Confidant'), ('favor_name_7', 'warm', 'Dear'), ('favor_name_8', 'warm', 'Cherished'),
  ('favor_name_9', 'warm', 'Devoted'), ('favor_name_10', 'warm', 'Beloved')
) AS x(condition_key, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, x.tier, s.id, x.expression, x.text
FROM (VALUES
  ('town.shop.greet', 4, 'warm', 'The shopkeeper pulls up a stool for me before I ask.'),
  ('town.shop.greet', 4, 'warm', 'The shopkeeper trusts my word over any scale.'),
  ('town.shop.greet', 4, 'warm', 'Come in, come in. The shopkeeper bolts the door behind me, laughing.'),
  ('town.shop.greet', 4, 'warm', 'The shopkeeper tells me things they tell no one else.'),
  ('town.shop.greet', 4, 'warm', 'The shopkeeper hands me the good tea, the one kept for guests.'),
  ('town.shop.greet', 4, 'warm', 'There is a place behind the counter that is mine now, the shopkeeper says.'),
  ('town.shop.refuse', 0, 'cold', 'The shopkeeper sees me and shuts the shutters.'),
  ('town.shop.refuse', 0, 'cold', 'Not you. Not here. The shopkeeper turns their back.'),
  ('town.shop.refuse', 0, 'cold', 'I know what you did. The door stays closed to you.'),
  ('town.shop.refuse', 0, 'cold', 'The shopkeeper spits to one side and says nothing.'),
  ('town.shop.refuse', 0, 'cold', 'Word got here before I did. Nobody will serve me.'),
  ('town.shop.refuse', 0, 'cold', 'The counter is bare, and the shopkeeper makes sure I see it.')
) AS x(condition_key, tier, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
