-- The boss (hidden). Fiend race; its move list caps its growth; move_budget levels are rolled when it is made (the
-- first time someone reaches the chamber); every vice born after the round start feeds it exp_per_vice move exp.
-- Weakening from keys (key_weakening, boss_set_weakening, already seeded) never passes max_weakening. First guesses.
INSERT INTO config.balance_config (config_key, value, description) VALUES
('boss', '{
  "race": "fiend",
  "moves": ["punch", "kick", "cross", "hook", "heavy_strike", "roundhouse", "hip_throw", "elbow_strike", "chain_punch",
            "martelo", "meia_lua", "nerve_strike", "pressure_jab", "cross_counter", "reversal", "brace", "eye_jab",
            "stumble_strike", "terrifying_roar", "taunt"],
  "move_budget": 250,
  "exp_per_vice": 400,
  "max_weakening": 0.6
}', 'Boss race, move list (caps its growth), levels rolled when made, move exp per vice born after the start, cap on key weakening.')
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT x.condition_key, 0, s.id, x.expression, x.text
FROM (VALUES
  ('boss_name_heart', 'neutral', 'The Heart of Ruin'),
  ('boss.sealed', 'tense', 'The way ahead is shut. It needs every kind of key to open.'),
  ('boss.sealed', 'tense', 'Something bars the way, waiting for keys I do not all have.'),
  ('boss.sealed', 'tense', 'The centre will not let me in. Not yet.'),
  ('boss.sealed', 'tense', 'I push, and the air pushes back. I am missing a key.'),
  ('boss.sealed', 'tense', 'The chamber stays sealed. Each key type must answer it.'),
  ('boss.sealed', 'tense', 'A cold wall I cannot see turns me back.'),
  ('boss.enter', 'grim', 'The keys in my soul burn, and the way opens.'),
  ('boss.enter', 'grim', 'Something gives inside me as the chamber opens.'),
  ('boss.enter', 'grim', 'The centre of everything rotten turns to look at me.'),
  ('boss.enter', 'grim', 'The air thickens. This is where it all began.'),
  ('boss.enter', 'grim', 'I step through, and the world goes very quiet.'),
  ('boss.enter', 'grim', 'It has waited for someone like me.'),
  ('boss.fell', 'calm', 'The heart of it all cracks, and light pours through.'),
  ('boss.fell', 'calm', 'It is over. The ground itself seems to breathe again.'),
  ('boss.fell', 'calm', 'The rot around me falls silent and still.'),
  ('boss.fell', 'calm', 'I did it. The thing at the centre is gone.'),
  ('boss.fell', 'calm', 'A long, low sound fades away, and then nothing.'),
  ('boss.fell', 'calm', 'The weight that pressed on this world lifts at last.')
) AS x(condition_key, expression, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
