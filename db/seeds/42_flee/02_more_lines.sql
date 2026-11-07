-- The startup check wants six lines per key: top up the flee lines.
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, x.expression, x.text
FROM (VALUES
  ('battle.fled', 'relieved', 'Gone before they could close in. My legs shake, but we are free.'),
  ('battle.fled', 'relieved', 'We got clear. Whatever that was, it will have to wait.'),
  ('battle.flee.fail', 'strained', 'They are on us again before I can turn.'),
  ('battle.flee.fail', 'strained', 'The gap I saw is gone. Not yet.'),
  ('battle.flee.boss', 'grim', 'Running is not an option here.'),
  ('battle.flee.boss', 'grim', 'There is only one way out of this room, and it is through it.'),
  ('battle.flee.boss', 'grim', 'My feet will not carry me away from this.')
) AS x(condition_key, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
