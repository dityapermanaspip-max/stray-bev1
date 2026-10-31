-- Step 3d: the world clock and the town tick. All hidden. Per world hour (world_time_scale real hours).
INSERT INTO config.balance_config (config_key, value, description) VALUES
('town_tick', '{"interval_hours":1,"reach":2,"villager_pay_share":0.5,"max_fill":1.2,
  "consume":{"food":0.02,"carcass":0.04,"part":0.01,"material":0.01,"weapon":0.002,"armor":0.002,"tool":0.003,"accessory":0.001},
  "hunt":{"per_worker":2},"wood":{"per_worker":3,"item":"oak_log","terrain":"tree","full_share":0.15},"craft":{"per_worker":2},
  "wages":{"hunter":2,"woodcutter":1,"cook":1,"tanner":1,"woodworker":1}}',
 'Town tick: villagers use consume[type] x capacity per tick and pay villager_pay_share of the price into the purse; hunters catch per_worker x density (natives above safe / max in hexes within reach) x clean share and bring the native loot yield; woodcutters bring per_worker x (best tree share / full_share) logs; craftsmen make per_worker batches; each worker is paid wages[job] from the purse or does not work; stock capped at capacity x max_fill.'),
('world_clock', '{"check_seconds":60,"catch_up_hours":48}', 'The server checks for due world hours every check_seconds and catches up at most catch_up_hours after a stop.')
ON CONFLICT (config_key) DO NOTHING;

-- The villagers' safe stock: the shop never sells below it.
UPDATE config.balance_config
SET value = jsonb_set(value || '{"safe_fill":0.1}'::jsonb, '{specialty,safe_fill}', '0.2'::jsonb)
WHERE config_key = 'economy';

-- The dev town's workforce (until recruits fill the jobs).
UPDATE world.town_economy e SET jobs = '{"hunter":2,"woodcutter":2,"cook":1,"tanner":1,"woodworker":1}'::jsonb
FROM world.hexes h JOIN world.rounds r ON r.id = h.round_id AND r.status = 'dev'
WHERE h.field_kind = 'town' AND e.town_ref = h.id::text;
