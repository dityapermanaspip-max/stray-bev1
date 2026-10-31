-- Growth curve (planned in SYSTEMS.md): breadth and depth pay about the same stats per hour, depth unlocks the tiers.
-- Cap 25; move exp to the next level is linear (30 + 16L: level 10 at 990, level 25 at 5520 total), so late levels
-- pay about half of early ones per exp instead of an eighth. A level-up pays 15 stat exp per point; points by tier
-- (tag tier:N, none = 1): tier 1 3, +1 every 6 levels; tier 2 5, +2; tier 3 7, +3; split by the move's stat shares.
UPDATE config.balance_config SET value = '25', updated_at = now(), description = 'Highest move level.'
WHERE config_key = 'move_level_cap';
UPDATE config.balance_config SET value = '{"a":30,"b":16,"c":0}', updated_at = now(),
  description = 'Move exp to next level = a + b*L + c*L^2. Level 2 at 46, level 10 at 990 total, level 25 at 5520.'
WHERE config_key = 'curve.move_exp_required';
UPDATE config.balance_config SET value = '{"a":15,"b":0}', updated_at = now(),
  description = 'Stat exp per point on a move level-up; growth.tiers sets the points, the move''s stat shares split them.'
WHERE config_key = 'curve.stat_exp_reward_base';
UPDATE config.balance_config SET value = '{"tiers":[1,7,13,25]}', updated_at = now(),
  description = 'Move level at which each word tier starts (clumsy, practiced, skilled, mastered): the 6-level bands, mastered at the cap.'
WHERE config_key = 'move_level_words';

INSERT INTO config.balance_config (config_key, value, description) VALUES
('growth.tiers', '{"band_levels":6,"tiers":{"1":[3,1],"2":[5,2],"3":[7,3]}}',
 'Stat exp points per move level-up by tier: [points, step]; step added for each band of band_levels levels (levels 2-6, 7-12, 13-18, 19-24, 25).'),
('growth.race_exp', '{"human":[{"max_level":6,"mult":1.15}]}',
 'Hidden move exp multipliers by race: rules with optional tags (any) and max_level (the move''s current level); matching rules multiply. Humans learn new moves fast.')
ON CONFLICT (config_key) DO NOTHING;
