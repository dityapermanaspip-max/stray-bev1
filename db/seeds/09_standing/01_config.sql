-- Standing (hidden): favor tiers, talk option gates, haggling, generous trade, the pushover mark, fame spread.
-- favor_tiers: favor needed for tiers 1.. (0 stranger, 1 known, 2 friend, 3 trusted).
-- charm_favor / charm_fame: each charm point counts as this much favor / fame when a gate is checked.
-- options: per talk option, the favor tier and town fame it needs.
-- haggle: one try per NPC per town visit; chance in per-mille from base plus charm, clamped; a win moves prices by
--   margin for the rest of the visit; a loss costs fail_favor.
-- generous: selling under or buying over the price by margin gives favor while favor is under tier cap_tier;
--   at or past it, the player becomes a pushover with that NPC for pushover.hours world hours.
-- pushover: prices worse by price_margin and haggle chance down by haggle_permille.
-- fame: a deed adds its amount in towns within radius hexes, times falloff per hex of distance.
INSERT INTO config.balance_config (config_key, value, description) VALUES
('standing', '{
  "favor_tiers": [10, 30, 60],
  "charm_favor": 1,
  "charm_fame": 1,
  "options": {"haggle": {"favor_tier": 1, "fame": 0}},
  "haggle": {"base_permille": 300, "charm_permille": 20, "min_permille": 50, "max_permille": 900, "margin": 0.1, "fail_favor": 3},
  "generous": {"margin": 0.2, "favor": 2, "cap_tier": 2},
  "pushover": {"hours": 72, "price_margin": 0.1, "haggle_permille": 200},
  "fame": {"radius": 2, "falloff": 0.5, "vice_kill": 20}
}', 'Hidden standing rules: favor tiers, option gates, haggling, generous trade, pushover, fame spread.')
ON CONFLICT (config_key) DO NOTHING;
