-- Early game pass: faster first growth, diverse builds, standby, weight, defeat, arrival.

UPDATE config.balance_config SET value = '{"a":20,"b":9,"c":2}', updated_at = now(),
  description = 'Move exp to next level = a + b*L + c*L^2. Level 2 at 31, level 10 at 1155 total, level 20 at 7030.'
WHERE config_key = 'curve.move_exp_required';

UPDATE config.balance_config SET value = '{"a":15,"b":0}', updated_at = now(),
  description = 'Flat stat exp per move level-up, times the move share. One mastered move gives about +5 main stat.'
WHERE config_key = 'curve.stat_exp_reward_base';

UPDATE config.balance_config SET value = '{"enabled":true,"full_at":0.4,"min_mult":0.1}', updated_at = now(),
  description = 'Full move exp if enemy total stats >= full_at of yours, else ratio/full_at, never below min_mult.'
WHERE config_key = 'move_exp_enemy_scaling';

-- Sitting replaces the old corridor-only rest ambush.
DELETE FROM config.balance_config WHERE config_key = 'rest_ambush_chance';

INSERT INTO config.balance_config (config_key, value, description) VALUES
('standby.regen', '{"stamina_full_seconds":20,"mana_full_seconds":40}', 'Sitting refills stamina and mana from empty in these times. Never HP.'),
('standby.ambush', '{"open_field_mult":1,"campfire_mult":0.25}', 'One ambush roll when sitting starts: field encounter chance times this.'),
('hot_mult_out_of_combat', '{"walking":1,"standing":2}', 'HoT speed outside combat. In combat uses combat.heal_in_combat_efficiency.'),
('combat.item_use_stamina_cost', '3', 'Stamina spent to use an item.'),
('combat.magic_stamina_share', '0.2', 'Magic also costs this share of its mana cost as stamina.'),
('weight_limits', '{"slow_at":0.7,"stuck_at":1.0,"slow_walk_mult":0.6,"slow_atb_mult":0.8}', 'Load share of maxInventoryWeight that slows, and that stops movement.'),
('defeat', '{"gear_durability_loss":0.1,"rescue_pickup_chance":0.4,"luck_bonus_cap":0.1,"rescuer_return":{"give":0.5,"ask":0.35,"keep":0.15},"ask_price_mult":0.5}', 'Passing out: gear durability loss, rescuer pickup chance per stack, what the rescuer does.'),
('arrival', '{"summoned_base_chance":0.6,"nudge_cap":0.1,"personality_weight":0.7}', 'Summoned chance before answer nudges (capped), and how strongly the companion answer sets personality.')
ON CONFLICT (config_key) DO NOTHING;

-- First unlocks earlier so the first epiphany lands in the first sessions.
UPDATE moves.move_unlocks u SET params = '{"move":"punch","level":4}'
FROM moves.moves m WHERE u.move_id = m.id AND m.move_name = 'heavy_strike' AND u.kind = 'mastery';
UPDATE moves.move_unlocks u SET params = '{"move":"kick","level":3}'
FROM moves.moves m WHERE u.move_id = m.id AND m.move_name = 'dodge_step' AND u.kind = 'mastery';
