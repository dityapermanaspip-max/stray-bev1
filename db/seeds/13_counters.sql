-- Counter stances (docs/MOVE_TREES.md). Use the stance; it waits a few effect turns.
-- Triggered: strike back once and earn exp. Not triggered or another move used: nothing, no exp.

INSERT INTO moves.effect_types (effect_name, handler_key) VALUES ('counter', 'counter')
ON CONFLICT (effect_name) DO NOTHING;

INSERT INTO moves.moves
  (move_name, category, damage_type_id, element, resource, cost, target, row_rule,
   atb_windup, atb_recovery, channel, exp_scaling, cooldown_seconds)
SELECT m.move_name, 'guard', d.id, NULL, 'stamina', m.cost, 'self', 'any', m.windup, m.recovery, false, 1.0, m.cooldown
FROM (VALUES
  ('cross_counter',   'blunt', 4, 0.1, 0.6, 8),
  ('catch_kick',      'blunt', 3, 0.1, 0.6, 6),
  ('esquiva_rasteira','blunt', 3, 0.0, 0.5, 6),
  ('reversal',        NULL,    3, 0.1, 0.6, 8),
  ('return_palm',     'blunt', 3, 0.0, 0.6, 5),
  ('drunken_fall',    'blunt', 3, 0.1, 0.7, 6)
) AS m(move_name, damage_type_name, cost, windup, recovery, cooldown)
LEFT JOIN moves.damage_types d ON d.damage_type_name = m.damage_type_name
ON CONFLICT (move_name) DO NOTHING;

-- power = counter strike power; momentum adds that share of the incoming hit.
INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
SELECT m.id, x.position, e.id, x.power, x.duration, 1.0, x.params::jsonb
FROM (VALUES
  ('cross_counter',    1, 'counter', 18, 3, '{"trigger":"hit","tags":["punch"],"take":1,"momentum":0.5,"accuracy":1.2,"crit_bonus":0.25}'),
  ('catch_kick',       1, 'counter', 12, 3, '{"trigger":"hit","tags":["kick"],"take":0.5,"momentum":0.2,"accuracy":1.1,"reply":{"handler":"bind","duration_turns":1,"chance":0.8}}'),
  ('esquiva_rasteira', 1, 'buff',     0, 3, '{"stat":"dodgeChance","add":0.25}'),
  ('esquiva_rasteira', 2, 'counter',  8, 3, '{"trigger":"dodge","tags":[],"take":0,"momentum":0,"accuracy":1.1,"reply":{"handler":"stun","duration_turns":1,"chance":0.6}}'),
  ('reversal',         1, 'counter',  0, 3, '{"trigger":"status","status":"bind","reply":{"handler":"bind","duration_turns":2,"chance":1}}'),
  ('return_palm',      1, 'counter',  6, 3, '{"trigger":"hit","tags":[],"take":0.6,"momentum":0.3,"accuracy":1.1,"reply":{"handler":"knockback","chance":1}}'),
  ('drunken_fall',     1, 'counter', 12, 3, '{"trigger":"hit","tags":[],"take":1,"momentum":0.3,"accuracy":1.0,"power_range":[0.2,2.5],"luck_skew":0.05}')
) AS x(move_name, position, effect_name, power, duration, params)
JOIN moves.moves m ON m.move_name = x.move_name
JOIN moves.effect_types e ON e.effect_name = x.effect_name
ON CONFLICT (move_id, position) DO NOTHING;

INSERT INTO moves.move_requires (move_id, kind, value, amount)
SELECT m.id, 'body_part', x.part, NULL
FROM (VALUES
  ('cross_counter','hands'), ('catch_kick','hands'), ('catch_kick','knees'), ('esquiva_rasteira','feet'),
  ('reversal','hands'), ('return_palm','hands'), ('drunken_fall','hands')
) AS x(move_name, part)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_requires r WHERE r.move_id = m.id AND r.kind = 'body_part' AND r.value = x.part);

INSERT INTO moves.move_stat_exp (move_id, stat, amount)
SELECT m.id, x.stat, x.amount
FROM (VALUES
  ('cross_counter','str',2), ('cross_counter','end',2),
  ('catch_kick','str',2), ('catch_kick','end',1), ('catch_kick','dex',1),
  ('esquiva_rasteira','dex',3), ('esquiva_rasteira','luck',1),
  ('reversal','str',2), ('reversal','end',2),
  ('return_palm','end',2), ('return_palm','str',1), ('return_palm','dex',1),
  ('drunken_fall','luck',3), ('drunken_fall','end',1)
) AS x(move_name, stat, amount)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, stat) DO NOTHING;

INSERT INTO moves.move_interrupts (move_id, role, tag)
SELECT m.id, 'gives', x.tag
FROM (VALUES
  ('cross_counter','damage'), ('catch_kick','damage'), ('esquiva_rasteira','damage'), ('esquiva_rasteira','stun'),
  ('return_palm','damage'), ('return_palm','knockback'), ('drunken_fall','damage')
) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, role, tag) DO NOTHING;

-- Strike tags that counters look for, plus tree/branch/growth tags for the new stances.
INSERT INTO moves.move_tags (move_id, tag)
SELECT m.id, x.tag
FROM (VALUES
  ('punch','punch'), ('jab','punch'), ('hook','punch'), ('cross','punch'), ('overhand','punch'),
  ('body_shot','punch'), ('chain_punch','punch'), ('backfist','punch'), ('gut_punch','punch'),
  ('heavy_strike','punch'), ('stumble_strike','punch'), ('cross_counter','punch'),
  ('kick','kick'), ('low_kick','kick'), ('front_kick','kick'), ('roundhouse','kick'), ('meia_lua','kick'),
  ('armada','kick'), ('martelo','kick'), ('bananeira','kick'), ('au','kick'), ('rasteira','kick'), ('esquiva_rasteira','kick'),
  ('cross_counter','branch:boxing'), ('catch_kick','branch:muay_thai'), ('esquiva_rasteira','branch:capoeira'),
  ('reversal','branch:grappling'), ('return_palm','branch:palm'), ('drunken_fall','branch:drunken_fist'),
  ('cross_counter','growth.heavy'), ('catch_kick','growth.guard'), ('esquiva_rasteira','growth.quick'),
  ('reversal','growth.guard'), ('return_palm','growth.guard'), ('drunken_fall','growth.heavy')
) AS x(move_name, tag)
JOIN moves.moves m ON m.move_name = x.move_name
ON CONFLICT (move_id, tag) DO NOTHING;

INSERT INTO moves.move_tags (move_id, tag)
SELECT m.id, t.tag
FROM moves.moves m CROSS JOIN (VALUES ('tree:unarmed'), ('unarmed'), ('melee'), ('counter')) AS t(tag)
WHERE m.move_name IN ('cross_counter','catch_kick','esquiva_rasteira','reversal','return_palm','drunken_fall')
ON CONFLICT (move_id, tag) DO NOTHING;

INSERT INTO moves.move_unlocks (move_id, option_group, kind, params)
SELECT m.id, 'a', 'mastery', jsonb_build_object('move', x.parent, 'level', x.level)
FROM (VALUES
  ('cross_counter','cross',6), ('catch_kick','knee_strike',6), ('esquiva_rasteira','esquiva',5),
  ('reversal','grab',5), ('return_palm','soft_palm',4), ('drunken_fall','sway_step',4)
) AS x(move_name, parent, level)
JOIN moves.moves m ON m.move_name = x.move_name
WHERE NOT EXISTS (SELECT 1 FROM moves.move_unlocks u WHERE u.move_id = m.id AND u.option_group = 'a');

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'move_name_' || x.move_name, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('cross_counter','Cross Counter'), ('catch_kick','Catch Kick'), ('esquiva_rasteira','Esquiva Rasteira'),
  ('reversal','Reversal'), ('return_palm','Return Palm'), ('drunken_fall','Drunken Fall')
) AS x(move_name, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'counter.fire', 0, s.id, 'determined', x.text
FROM (VALUES
  ('There it is. My turn.'),
  ('You walked right into that.'),
  ('I took that one so I could give this one back.'),
  ('Your own weight is coming back at you.'),
  ('I was waiting for exactly that.'),
  ('Thanks for the opening.')
) AS x(text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;
