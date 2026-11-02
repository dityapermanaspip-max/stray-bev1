-- Closing period after the boss first falls, in real hours (not scaled by world_time_scale).
INSERT INTO config.balance_config (config_key, value, description) VALUES
('round', '{"closing_hours":48}', 'Real hours a round stays open after its boss first falls, then it ends.')
ON CONFLICT (config_key) DO NOTHING;
