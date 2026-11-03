-- A companion's status window opens at this favor tier (hidden: config only).
UPDATE config.balance_config SET value = jsonb_set(value, '{ladder,unlocks,status}', '3') WHERE config_key = 'standing';
