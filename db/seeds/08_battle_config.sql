-- Battle simulator config (step 1).
-- Chance factors give fractions directly (stats.py values were percents).
UPDATE config.balance_config
SET value = '{"crit":0.001,"dodge":0.001,"min_pair_mult":2}',
    description = 'crit = sqrt(luck*accuracy)*crit, dodge = sqrt(luck*speed)*dodge, as fractions. accuracy and speed = min(sqrt(a*b), min_pair_mult*min(a,b)).',
    updated_at = now()
WHERE config_key = 'derived.chance_factors';

INSERT INTO config.balance_config (config_key, value, description) VALUES
('combat.effect_turn_ms', '1000', 'Length of one effect turn (over-time ticks, durations) in battle.'),
('combat.guard_reduction_cap', '0.8', 'Highest share of damage a guard can block.'),
('combat.min_damage', '1', 'Smallest damage a landed hit deals.'),
('player_start_stats', '{"str":5,"dex":5,"int":5,"end":5,"luck":5,"charm":5}', 'Core stats of a newly Summoned player.'),
('player_start_moves', '["punch","kick"]', 'Moves every Summoned knows on arrival.'),
('ai.heal_below_tier', '2', 'Battle AI heals an ally whose health tier is at or below this.')
ON CONFLICT (config_key) DO NOTHING;
