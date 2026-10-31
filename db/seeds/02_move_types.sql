-- Damage types, effect handlers, and status rows.
INSERT INTO moves.damage_types (damage_type_name, kind) VALUES
('blunt', 'physical'),
('slash', 'physical'),
('pierce', 'physical'),
('force', 'magic'),
('poison', 'physical')
ON CONFLICT (damage_type_name) DO NOTHING;

INSERT INTO moves.effect_types (effect_name, handler_key) VALUES
('damage', 'damage'),
('damage_over_time', 'damage_over_time'),
('heal_over_time', 'heal_over_time'),
('channel', 'channel'),
('guard', 'guard'),
('stun', 'stun'),
('silence', 'silence'),
('knockback', 'knockback'),
('disarm', 'disarm'),
('disable_part', 'disable_part'),
('buff', 'buff'),
('debuff', 'debuff'),
('taunt', 'taunt'),
('scavenge', 'scavenge')
ON CONFLICT (effect_name) DO NOTHING;

INSERT INTO moves.status_types
  (status_name, effect_type_id, damage_type_id, element, stack_rule, ignores_defense, tick_interval, cure_tags)
SELECT s.status_name, e.id, d.id, s.element, s.stack_rule, s.ignores_defense, s.tick_interval, s.cure_tags
FROM (VALUES
  ('bleed',  'slash',  NULL,   'stack',     false, 1, ARRAY['bandage']),
  ('burn',   'force',  'fire', 'strongest', false, 1, ARRAY['water']),
  ('poison', 'poison', NULL,   'stack',     true,  1, ARRAY['antidote'])
) AS s(status_name, damage_type_name, element, stack_rule, ignores_defense, tick_interval, cure_tags)
JOIN moves.effect_types e ON e.effect_name = 'damage_over_time'
JOIN moves.damage_types d ON d.damage_type_name = s.damage_type_name
ON CONFLICT (status_name) DO NOTHING;
