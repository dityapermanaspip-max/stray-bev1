-- Keeper looks (2026-11-03): the actor sheet each door's keeper stands in (path under public/assets/actors).
UPDATE config.balance_config
SET value = jsonb_set(value, '{rooms,shop,keeper,look}', '"characters/human/shopkeeper/shopkeeper"')
WHERE config_key = 'interior';
