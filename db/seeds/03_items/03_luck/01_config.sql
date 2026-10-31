-- Luck (Step 1.9). Chances are out of 1000; luck adds flat per-mille to good rolls and takes it from bad ones.

INSERT INTO config.balance_config (config_key, value, description) VALUES
('luck', '{"per_point":1,"bad_floor":0}',
 'Per-mille added to a good chance (taken from a bad one) per luck point. A bad chance never falls below bad_floor x its base. Hidden.'),
('quality_nudge_permille', '20', 'Out of 1000: a butchered part comes out one quality step better. The cutter''s luck adds to it.'),
('ammo_recovery_permille', '500', 'Out of 1000: each fired arrow or thrown item recovered on a win. The thrower''s luck adds to it.')
ON CONFLICT (config_key) DO NOTHING;

-- Databases seeded before Step 1.9: the butcher's share moves to per-mille and the butcher gets their own luck.
UPDATE config.balance_config
SET value = (value - 'cut_share') || '{"cut_share_permille":400,"npc_luck":10}'::jsonb,
    description = 'Butchery skill: drop chance multiplier = chance_base + chance_per_level x level (essence ignores it); one quality step at each quality_up_at level. A town butcher works at npc_level, for fee_per_weight copper per carcass weight, or keeps each part unit with cut_share_permille out of 1000. The town butcher cuts with npc_luck.'
WHERE config_key = 'butchery' AND value ? 'cut_share';

DELETE FROM config.balance_config WHERE config_key = 'ammo_recovery_chance';
