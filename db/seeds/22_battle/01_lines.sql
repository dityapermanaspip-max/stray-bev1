-- Battle screen text (Steps 2e, 2f): species display names, a body word per resource tier (tier 1 = near collapse,
-- 5 = untouched; shown under every fighter), and the end and refusal sentences.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, x.tier, s.id, 'neutral', x.text
FROM (VALUES
  ('species_name_chicken', 0, 'Chicken'),
  ('species_name_lizard', 0, 'Lizard'),
  ('species_name_cat', 0, 'Cat'),
  ('body_word.hp', 1, 'Collapsing'),
  ('body_word.hp', 2, 'Badly hurt'),
  ('body_word.hp', 3, 'Hurt'),
  ('body_word.hp', 4, 'Bruised'),
  ('body_word.hp', 5, 'Unhurt'),
  ('body_word.stamina', 1, 'Spent'),
  ('body_word.stamina', 2, 'Gasping'),
  ('body_word.stamina', 3, 'Winded'),
  ('body_word.stamina', 4, 'Steady'),
  ('body_word.stamina', 5, 'Fresh'),
  ('body_word.mana', 1, 'Empty'),
  ('body_word.mana', 2, 'Flickering'),
  ('body_word.mana', 3, 'Dimmed'),
  ('body_word.mana', 4, 'Humming'),
  ('body_word.mana', 5, 'Brimming')
) AS x(condition_key, tier, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, x.expression, x.text
FROM (VALUES
  ('battle.won', 'relieved', 'It is over, and I am still standing.'),
  ('battle.won', 'relieved', 'Quiet again. I let my breath out slowly.'),
  ('battle.won', 'relieved', 'Nothing else moves. I won this one.'),
  ('battle.won', 'relieved', 'My hands are shaking, but I made it through.'),
  ('battle.won', 'relieved', 'That could have gone worse.'),
  ('battle.won', 'relieved', 'The last of them is down.'),
  ('battle.lost', 'pained', 'I wake where I first came into this place, sore but whole.'),
  ('battle.lost', 'pained', 'Everything went black. Now I am back at the edge of the field.'),
  ('battle.lost', 'pained', 'I do not remember falling, only waking far from where I fell.'),
  ('battle.lost', 'pained', 'Somehow I am back where I started, aching all over.'),
  ('battle.lost', 'pained', 'The ground is cold. I am back at the way in.'),
  ('battle.lost', 'pained', 'I lost. I wake at the field''s edge with the taste of dirt.'),
  ('battle.cannot', 'strained', 'I cannot do that right now.'),
  ('battle.cannot', 'strained', 'That will not work from here.'),
  ('battle.cannot', 'strained', 'My body will not answer that.'),
  ('battle.cannot', 'strained', 'Not that, not now.'),
  ('battle.cannot', 'strained', 'I reach for it, and nothing comes.'),
  ('battle.cannot', 'strained', 'There is no way to do that here.')
) AS x(condition_key, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
