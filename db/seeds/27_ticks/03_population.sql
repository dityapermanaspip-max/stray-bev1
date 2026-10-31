-- Step 3d: settlement population is the base of the town tick. What villagers use from the store is per 100 people
-- per tick (most of their food is their own farms', not tracked); 40% of the people work, spread over job shares.
-- Rates scaled from the 27_ticks/02 tuning so the dev village (300 people, 120 workers) keeps the same totals.
UPDATE config.balance_config SET value = (value - 'consume')
  || '{"consume_per_100":{"food":0.67,"carcass":0.1,"part":0.5,"material":0.5,"weapon":0.007,"armor":0.013,"tool":0.01,"accessory":0.003}}'::jsonb
  || '{"workforce_share":0.4,"hunt":{"per_worker":0.6},"craft":{"per_worker":0.25}}'::jsonb
  || '{"wood":{"per_worker":0.15,"item":"oak_log","terrain":"tree","full_share":0.15}}'::jsonb
  || '{"wages":{"hunter":0.15,"woodcutter":0.07,"cook":0.15,"tanner":0.15,"woodworker":0.15}}'::jsonb,
  description = 'Town tick, per settlement population: villagers use consume_per_100[type] x population / 100 store goods per tick over all items of the type (divided by the price multiplier) and pay villager_pay_share of the price into the purse; population x workforce_share work, spread by the town''s job shares; hunters catch per_worker x density (natives above safe / max in hexes within reach) x clean share each and bring the native loot yield; woodcutters bring per_worker x (best tree share / full_share) logs each; craftsmen make per_worker batches each; store-supplying workers are paid wages[job] each from the purse or stay home; common jobs (farmer, laborer, guard) feed the village and bring nothing to the store; stock capped at capacity x max_fill.'
WHERE config_key = 'town_tick';

-- The beginner village: 300 people, 120 workers. 1-5% of a settlement is recruitable (recruit pool, later).
UPDATE world.town_economy e SET population = 300, jobs = '{"farmer":0.35,"laborer":0.10,"guard":0.10,
  "hunter":0.12,"woodcutter":0.12,"tanner":0.08,"cook":0.07,"woodworker":0.06}'::jsonb
FROM world.hexes h JOIN world.rounds r ON r.id = h.round_id AND r.status = 'dev'
WHERE h.field_kind = 'town' AND e.town_ref = h.id::text;
