-- Battle formation per side: 4 front and 3 back slots; a party of up to 4 (the player and 3 companions), up to 7 foes.
-- knockback_blocked_share: collision damage (share of the knockback hit) to the target and the fighter behind it
-- when the slot behind is taken.
INSERT INTO config.balance_config (config_key, value, description) VALUES
('battle.formation', '{"front":4,"back":3,"party_max":4,"enemy_max":7,"knockback_blocked_share":0.25}',
 'Battle slots per side (front first, then back), party and enemy limits, and the collision damage share of a blocked knockback.')
ON CONFLICT (config_key) DO NOTHING;
