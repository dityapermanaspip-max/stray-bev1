-- Vice fights (hidden). A vice is of the fiend race (hands, feet, knees, elbows, body, voice). It knows its type's
-- moves from birth (all open: they train its type's stat) with levels rolled from its ring's creature move budget
-- + budget_bonus, best ones equipped. It grows like a player once born. First guesses, tune later.
INSERT INTO entity.races (race_name, body_parts, stat_mods, size) VALUES
('fiend', ARRAY['hands','feet','knees','elbows','body','voice'], '{}', 'medium')
ON CONFLICT (race_name) DO NOTHING;

UPDATE config.balance_config SET value = value || '{
  "race": "fiend",
  "budget_bonus": 40,
  "moves": {
    "str": ["punch", "kick", "cross", "hook", "overhand", "gut_punch", "heavy_strike", "roundhouse", "hip_throw", "knee_strike", "elbow_strike", "brace"],
    "dex": ["punch", "kick", "jab", "chain_punch", "backfist", "low_kick", "front_kick", "martelo", "au", "ginga", "dodge_step", "meia_lua"],
    "int": ["punch", "kick", "pressure_jab", "nerve_strike", "spear_hand", "palm_strike", "soft_palm", "return_palm", "arm_lock", "bandage", "guard", "dodge_step"],
    "end": ["punch", "kick", "guard", "brace", "body_shot", "palm_strike", "soft_palm", "reversal", "cross_counter", "clinch", "catch_kick", "bandage"],
    "luck": ["punch", "kick", "eye_jab", "sway_step", "drunken_fall", "stumble_strike", "dodge_step", "backfist", "armada", "esquiva", "esquiva_rasteira", "gut_punch"],
    "charm": ["punch", "kick", "taunt", "rally", "roar", "bellow", "hiss", "terrifying_roar", "eye_jab", "cross", "guard", "jab"]
  }
}'::jsonb,
description = 'Vice types (one per core stat); main_weight of the type''s stat; find_permille: chance an encounter in a vice''s hex is the vice; race; budget_bonus move levels over the ring budget; moves known from birth per type.'
WHERE config_key = 'vice';
