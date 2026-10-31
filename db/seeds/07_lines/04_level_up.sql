-- Stat growth. Tier 0 (no tier). Never names a number. Spoken by the entity.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, 'happy', x.text
FROM (VALUES
  ('level_up.str', 'My arms feel harder than they did this morning.'),
  ('level_up.str', 'I lifted that without thinking about it.'),
  ('level_up.str', 'There is new weight behind my blows.'),
  ('level_up.str', 'My grip has grown stronger.'),
  ('level_up.str', 'My shoulders feel broader somehow.'),
  ('level_up.str', 'I can feel the power coiled in my back.'),
  ('level_up.dex', 'My hands move before I tell them to.'),
  ('level_up.dex', 'My footing feels lighter and surer.'),
  ('level_up.dex', 'I am quicker than I used to be.'),
  ('level_up.dex', 'My fingers have grown nimble.'),
  ('level_up.dex', 'I slip between moments a little easier now.'),
  ('level_up.dex', 'My balance feels sharper.'),
  ('level_up.int', 'Things I missed before seem obvious now.'),
  ('level_up.int', 'My thoughts are clearer than yesterday.'),
  ('level_up.int', 'I see the pattern a moment sooner.'),
  ('level_up.int', 'My mind feels wider somehow.'),
  ('level_up.int', 'Ideas come to me faster now.'),
  ('level_up.int', 'I understand this world a little better.'),
  ('level_up.end', 'My body shrugs off what used to hurt.'),
  ('level_up.end', 'I can last longer than I could before.'),
  ('level_up.end', 'My skin feels tougher.'),
  ('level_up.end', 'Pain does not shake me like it did.'),
  ('level_up.end', 'My breath holds steadier under strain.'),
  ('level_up.end', 'I feel more solid on my feet.'),
  ('level_up.luck', 'Fortune seems to lean my way lately.'),
  ('level_up.luck', 'Things keep falling into place for me.'),
  ('level_up.luck', 'I have a good feeling about today.'),
  ('level_up.luck', 'Small chances keep breaking in my favor.'),
  ('level_up.luck', 'The world feels a little kinder to me.'),
  ('level_up.luck', 'I trust my hunches more now.'),
  ('level_up.charm', 'People seem to listen when I speak.'),
  ('level_up.charm', 'My voice carries more warmth than before.'),
  ('level_up.charm', 'Strangers meet my eyes more easily.'),
  ('level_up.charm', 'I know what to say a little sooner.'),
  ('level_up.charm', 'My presence fills the room more than it did.'),
  ('level_up.charm', 'Others seem to feel braver around me.')
) AS x(condition_key, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
