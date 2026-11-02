-- Invasions are checked every interval_hours (before world_time_scale), like feeding.
UPDATE config.balance_config SET value = value || '{"interval_hours":10}'::jsonb,
  description = 'Invasion every interval_hours when total >= threshold * max and a vice leads: share of the corrupted leave with the vice.'
WHERE config_key = 'tick.invasion';
