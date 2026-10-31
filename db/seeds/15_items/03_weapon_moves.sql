-- Basic weapon moves. Each is learned the first time a weapon of its type is equipped (item wield.grants_move).
-- Weapon trees beyond these come later, built like the unarmed tree.

INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule,
   atb_windup, atb_recovery, channel, exp_scaling)
SELECT m.move_name, 'attack', d.id, NULL, 'stamina', m.cost, 'one_enemy', m.row_rule, m.windup, m.recovery, false, 1.0
FROM (VALUES
  ('knife_stab',   'pierce', 2, 'front', 0.0, 0.8),
  ('club_swing',   'blunt',  3, 'front', 0.2, 1.2),
  ('hammer_smash', 'blunt',  6, 'front', 0.6, 1.7),
  ('sword_slash',  'slash',  3, 'front', 0.1, 1.0),
  ('basic_throw',  'blunt',  2, 'any',   0.1, 1.0)
) AS m(move_name, damage_type_name, cost, row_rule, windup, recovery)
JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;

INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, x.chance, x.params::jsonb
FROM (VALUES
  ('knife_stab',   1, 'damage', 6,  NULL, 1.0,  '{"accuracy":1.05,"hit_count":1}'),
  ('club_swing',   1, 'damage', 8,  NULL, 1.0,  '{"accuracy":1.0,"hit_count":1}'),
  ('hammer_smash', 1, 'damage', 14, NULL, 1.0,  '{"accuracy":0.85,"hit_count":1}'),
  ('hammer_smash', 2, 'stun',   0,  1,    0.15, '{}'),
  ('sword_slash',  1, 'damage', 9,  NULL, 1.0,  '{"accuracy":1.0,"hit_count":1}'),
  ('basic_throw',  1, 'damage', 5,  NULL, 1.0,  '{"accuracy":0.9,"hit_count":1}')
) AS x(move_name, position, effect_name, power, duration, chance, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT (move_id, position) DO NOTHING;

INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, x.kind, x.value, NULL
FROM (VALUES
  ('knife_stab','weapon_type','knife'), ('club_swing','weapon_type','club'), ('hammer_smash','weapon_type','hammer'),
  ('sword_slash','weapon_type','sword'), ('basic_throw','weapon_type','thrown'),
  ('knife_stab','body_part','hands'), ('club_swing','body_part','hands'), ('hammer_smash','body_part','hands'),
  ('sword_slash','body_part','hands'), ('basic_throw','body_part','hands')
) AS x(move_name, kind, value)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = x.kind AND r.value = x.value);

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES
  ('knife_stab','dex',3), ('knife_stab','str',1),
  ('club_swing','str',3), ('club_swing','end',1),
  ('hammer_smash','str',4), ('hammer_smash','end',2),
  ('sword_slash','str',2), ('sword_slash','dex',2),
  ('basic_throw','dex',3), ('basic_throw','luck',1)
) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT m.id, 'gives', x.tag
FROM (VALUES
  ('knife_stab','damage'), ('club_swing','damage'), ('hammer_smash','damage'), ('hammer_smash','stun'),
  ('sword_slash','damage'), ('basic_throw','damage')
) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, role, tag) DO NOTHING;

INSERT INTO moves.move_tags (move_id, tag)
SELECT m.id, x.tag
FROM (VALUES
  ('knife_stab','growth.quick'), ('knife_stab','tree:knife'), ('knife_stab','melee'),
  ('club_swing','growth.heavy'), ('club_swing','tree:club'), ('club_swing','melee'),
  ('hammer_smash','growth.heavy'), ('hammer_smash','tree:hammer'), ('hammer_smash','melee'),
  ('sword_slash','growth.quick'), ('sword_slash','tree:sword'), ('sword_slash','melee'),
  ('basic_throw','growth.quick'), ('basic_throw','tree:thrown'), ('basic_throw','ranged'),
  ('knife_stab','branch:basic'), ('club_swing','branch:basic'), ('hammer_smash','branch:basic'),
  ('sword_slash','branch:basic'), ('basic_throw','branch:basic')
) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, tag) DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'move_name_' || x.move_name, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('knife_stab','Stab'), ('club_swing','Club Swing'), ('hammer_smash','Smash'),
  ('sword_slash','Slash'), ('basic_throw','Throw')
) AS x(move_name, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
