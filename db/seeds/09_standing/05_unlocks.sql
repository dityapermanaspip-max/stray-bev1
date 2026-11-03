-- What each favor tier opens (a tier number per key), the favor a paid salary day adds on top of the talk cap, and
-- how many world days one wage payment covers. Hidden. butcher_child: the butcher offers his adult child at this tier.
UPDATE config.balance_config
SET value = jsonb_set(value, '{ladder}', (value->'ladder') || '{
  "unlocks": {"hire": 1, "gift": 2, "party": 3, "loadout": 4, "butcher_child": 4, "command": 5},
  "salary_favor": 5, "hire_days": 1
}'::jsonb)
WHERE config_key = 'standing';
