-- Gear in battle (Step 1.7b).
INSERT INTO config.balance_config (config_key, value, description) VALUES
('gear_wear_per_hit', '1', 'Durability a weapon loses per landed hit; one armor piece (picked by body share) loses this per hit taken.')
ON CONFLICT (config_key) DO NOTHING;
