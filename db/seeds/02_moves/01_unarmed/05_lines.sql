-- Display names for the unarmed leaves, and bind status lines (vague, no numbers).
INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'move_name_' || x.move_name, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('jab','Jab'), ('hook','Hook'), ('body_shot','Body Shot'), ('cross','Cross'), ('overhand','Overhand'),
  ('palm_strike','Palm Strike'), ('soft_palm','Soft Palm'), ('spear_hand','Spear Hand'),
  ('chain_punch','Chain Punch'), ('backfist','Backfist'), ('gut_punch','Gut Punch'), ('eye_jab','Eye Jab'),
  ('grab','Grab'), ('hip_throw','Hip Throw'), ('arm_lock','Arm Lock'),
  ('knee_strike','Knee Strike'), ('elbow_strike','Elbow Strike'), ('clinch','Clinch'),
  ('low_kick','Low Kick'), ('front_kick','Front Kick'), ('roundhouse','Roundhouse'),
  ('nerve_strike','Nerve Strike'), ('pressure_jab','Pressure Jab'),
  ('stumble_strike','Stumble Strike'), ('sway_step','Sway Step'),
  ('ginga','Ginga'), ('esquiva','Esquiva'), ('meia_lua','Meia Lua'), ('rasteira','Rasteira'),
  ('au','Au'), ('armada','Armada'), ('martelo','Martelo'), ('bananeira','Bananeira')
) AS x(move_name, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, x.expression, x.text
FROM (VALUES
  ('status.bind.start', 'pained', 'I cannot move, they have me pinned.'),
  ('status.bind.start', 'pained', 'Their grip locks around me.'),
  ('status.bind.start', 'pained', 'I am caught and cannot pull free.'),
  ('status.bind.start', 'pained', 'Every limb is tangled up in theirs.'),
  ('status.bind.start', 'pained', 'They hold me fast and I cannot strike back.'),
  ('status.bind.start', 'pained', 'I am stuck in their hold.'),
  ('status.bind.end', 'relieved', 'I slip out of the hold.'),
  ('status.bind.end', 'relieved', 'Their grip finally gives way.'),
  ('status.bind.end', 'relieved', 'I am free to move again.'),
  ('status.bind.end', 'relieved', 'I wrench myself loose.'),
  ('status.bind.end', 'relieved', 'The hold breaks and I can breathe.'),
  ('status.bind.end', 'relieved', 'My limbs are my own again.')
) AS x(condition_key, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
