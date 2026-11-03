-- The favor ladder replaces the flat favor_tiers list. Hidden.
-- tiers: tiers above stranger. step_mult: each step is this times the one before, rounded up (T, 1.35 T, ...);
--   a tier needs the sum of the steps so far (T = 20: 20, 47, 84, 134, 202, 294, 419, 588, 817, 1127).
-- talk_cap: favor-giving contacts per NPC per tick; talk_tick_hours: world hours in one tick.
-- fame_div / fame_floor: a talk gives charm x max(fame_floor, 1 + town fame / fame_div).
-- gift: opens at min_tier, one per per_days real days, worth favor.
-- same_sex_max_tier: a pair of the same body type stops here (the top tier is the romantic one, later).
-- summoner_start_tier: the player's own summoner starts at this tier with them (recruitable at the start).
-- greet_tiers: how many tiers the startup check wants shopkeeper greetings for (higher tiers reuse the last).
-- refuse_fame: a shop turns away a player whose fame in its town is at or under this.
-- roles: base threshold T by role (door service, notable role, template kind) and its random spread.
UPDATE config.balance_config
SET value = (value - 'favor_tiers') || '{
  "ladder": {
    "tiers": 10, "step_mult": 1.35, "talk_cap": 2, "talk_tick_hours": 1, "fame_div": 10, "fame_floor": 0.1,
    "gift": {"min_tier": 2, "per_days": 1, "favor": 10},
    "same_sex_max_tier": 9, "summoner_start_tier": 3, "greet_tiers": 4, "refuse_fame": -5,
    "roles": {
      "default": {"base": 30, "spread": 0.25},
      "mercenary": {"base": 20, "spread": 0.25}, "recruit": {"base": 25, "spread": 0.25}, "summoner": {"base": 25, "spread": 0.2},
      "shop": {"base": 30, "spread": 0.25}, "inn": {"base": 30, "spread": 0.25}, "cook": {"base": 35, "spread": 0.25},
      "blacksmith": {"base": 40, "spread": 0.25}, "herbalist": {"base": 40, "spread": 0.25}, "woodworker": {"base": 40, "spread": 0.25},
      "butcher": {"base": 50, "spread": 0.25}, "trainer": {"base": 60, "spread": 0.25}, "guild": {"base": 80, "spread": 0.25},
      "temple": {"base": 80, "spread": 0.25}, "merchant": {"base": 70, "spread": 0.25}, "chief_guard": {"base": 90, "spread": 0.25},
      "village_elder": {"base": 100, "spread": 0.25}, "mayor": {"base": 120, "spread": 0.25}
    }
  }
}'::jsonb
WHERE config_key = 'standing';
