-- A fishing spot stands ON reachable water (2026-11-04), worked from the bank beside it, like the other nodes are worked
-- from beside. `on`: the terrains a kind stands on (water-like, not walkable); `near` stays for kinds that stand on
-- ground beside something. The spot is only taken when a reachable tile within a climbing step lies beside it.
UPDATE config.balance_config
SET value = jsonb_set(jsonb_set(value, '{kinds,fish,on}', '["water","sea","frozen_lake"]'), '{kinds,fish,near}', '[]')
WHERE config_key = 'gather';
