-- Town tick rates tuned with npm run sim:town (Step 3d). consume = goods per tick for all items of a type together
-- (at base price; villagers use less of what is dear). Over 30 world days in the dev town: raw meat holds at the safe
-- stock (the cook grills the rest), grilled chicken moves between about 5 and 11 copper, wood and leather run full
-- and cheap (its specialties), the purse grows about 80 copper a day.
UPDATE config.balance_config SET value = value
  || '{"consume":{"food":2,"carcass":0.3,"part":1.5,"material":1.5,"weapon":0.02,"armor":0.04,"tool":0.03,"accessory":0.01}}'::jsonb
  || '{"hunt":{"per_worker":4},"wood":{"per_worker":1,"item":"oak_log","terrain":"tree","full_share":0.15}}'::jsonb,
  description = 'Town tick: villagers use consume[type] goods per tick over all items of the type (divided by the price multiplier) and pay villager_pay_share of the price into the purse; hunters catch per_worker x density (natives above safe / max in hexes within reach) x clean share and bring the native loot yield; woodcutters bring per_worker x (best tree share / full_share) logs; craftsmen make per_worker batches; each worker is paid wages[job] from the purse or does not work; stock capped at capacity x max_fill.'
WHERE config_key = 'town_tick';
