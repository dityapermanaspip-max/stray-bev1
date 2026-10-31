-- Every balance number lives here. Placeholders, tune later through the admin page.
INSERT INTO config.balance_config (config_key, value, description) VALUES
-- World and round
('world_time_scale', '1', 'Multiplier on every tick interval. Lower = faster world for testing.'),
('ring_count', '4', 'Hex rings around the boss hex for a round.'),
('corridor_range', '{"min":3,"max":7}', 'Corridor fields per border.'),
('corridor_rest_spot_chance', '0.2', 'Chance a corridor field gets a cave or campfire.'),
('rest_ambush_chance', '{"base":0.05,"per_ring":0.03,"per_corruption":0.2,"cap":0.6}', 'Rolled once when resting in a corridor.'),
('currency_ratio', '100', 'Copper per silver and silver per gold.'),

-- Loadout
('loadout_slots', '8', 'Equipped move slots.'),
('loadout_swap_anywhere', 'true', 'Testing flag: swaps allowed outside towns until towns exist.'),

-- Growth curves (ported from stats.py)
('move_level_cap', '20', 'Highest move level.'),
('usage_exp', '{"hit":5,"miss":2,"critical":8,"kill":12}', 'Move exp per use outcome. Kill only for corrupted.'),
('curve.move_exp_required', '{"a":30,"b":10,"c":2}', 'Move exp to next level = a + b*L + c*L^2.'),
('curve.stat_exp_reward_base', '{"a":15,"b":3}', 'Stat exp base on move level-up = a + b*L.'),
('curve.stat_exp_required', '{"a":47,"b":17}', 'Stat exp to next level = a + b*L.'),
('move_exp_enemy_scaling', '{"enabled":true,"min_mult":0.1}', 'Scale move exp by enemy strength to stop farming.'),

-- Derived stats (ported from stats.py calc_derived)
('derived.max_hp', '{"sqrt_str_end":10,"end":4}', 'floor(sqrt(str*end)*a + end*b).'),
('derived.max_stamina', '{"sqrt_dex_end":4,"end":14}', 'floor(sqrt(dex*end)*a + end*b).'),
('derived.max_mana', '{"sqrt_int_end":4,"end":9,"int":2}', 'floor(sqrt(int*end)*a + end*b + int*c).'),
('derived.max_inventory_weight', '{"str":12,"base":30}', 'floor(str*a + base).'),
('derived.chance_factors', '{"crit":0.1,"dodge":0.1,"min_pair_mult":2}', 'crit = sqrt(luck*accuracy)*crit, dodge = sqrt(luck*speed)*dodge.'),

-- Combat math
('combat.stat_mult', '{"base":0.5,"divisor":10}', 'stat_mult = base + attack_stat / divisor.'),
('combat.hit_chance', '{"base":0.5,"divisor":20}', 'hit = min(1, move_accuracy * (base + accuracy / divisor)) * (1 - dodge).'),
('combat.dodge_cap', '0.5', 'Highest dodge chance.'),
('combat.defense_constant', '20', 'reduction = defense / (defense + constant).'),
('combat.crit_mult', '1.5', 'Damage multiplier on a critical hit.'),
('combat.heal_in_combat_efficiency', '0.5', 'Heal-over-time efficiency during a battle.'),
('combat.stun_immunity_turns', '2', 'Turns of stun immunity after a stun ends.'),
('combat.atb_tick_ms', '100', 'Server ATB tick length in milliseconds.'),
('combat.atb_fill_per_speed', '1', 'ATB gauge fill per tick per point of speed.'),
('combat.atb_full', '100', 'Gauge value that grants a turn.'),
('combat.disconnect_grace_ms', '5000', 'Time a disconnected player acts on the default move.'),
('ammo_recovery_permille', '500', 'Out of 1000: each fired arrow or thrown item recovered on a win. The thrower''s luck adds to it.'),
('luck_drop_bonus_cap', '0.1', 'Highest bonus luck adds to a drop roll. Never applies to keys.'),

-- Growth tags: level scalers per tag
('growth.heavy.damage_per_level', '0.03', 'Heavy moves: damage gain per level.'),
('growth.heavy.recovery_per_level', '-0.01', 'Heavy moves: recovery change per level.'),
('growth.heavy.cost_per_level', '-0.01', 'Heavy moves: cost change per level.'),
('growth.quick.damage_per_level', '0.03', 'Quick moves: damage gain per level.'),
('growth.quick.recovery_per_level', '-0.01', 'Quick moves: recovery change per level.'),
('growth.quick.cost_per_level', '-0.01', 'Quick moves: cost change per level.'),
('growth.guard.damage_per_level', '0.03', 'Guard moves: block gain per level.'),
('growth.guard.recovery_per_level', '-0.01', 'Guard moves: recovery change per level.'),
('growth.guard.cost_per_level', '-0.01', 'Guard moves: cost change per level.'),
('growth.magic.damage_per_level', '0.03', 'Magic moves: damage gain per level.'),
('growth.magic.recovery_per_level', '-0.01', 'Magic moves: recovery change per level.'),
('growth.magic.cost_per_level', '-0.01', 'Magic moves: cost change per level.'),

-- Weapon quality tiers
('quality.crude.power_mult', '0.8', 'Crude weapon power.'),
('quality.common.power_mult', '1.0', 'Common weapon power.'),
('quality.fine.power_mult', '1.2', 'Fine weapon power.'),
('quality.masterwork.power_mult', '1.5', 'Masterwork weapon power.'),
('quality.roll', '{"skill_weight":0.5,"facility_weight":0.3,"material_weight":0.2,"luck_cap":0.05}', 'Crafted output quality inputs.'),

-- Body-state tiers: fraction of max at or above which each tier starts, worst (1) to best (5)
('body_tiers', '{"hp":[0,0.15,0.4,0.65,0.9],"stamina":[0,0.15,0.4,0.65,0.9],"mana":[0,0.15,0.4,0.65,0.9]}', 'Tier thresholds for body-state words.'),
('move_level_words', '{"tiers":[1,5,10,20]}', 'Move level at which each word tier starts (clumsy, practiced, skilled, mastered).'),

-- World tick (counts only). Hours are real hours before world_time_scale.
('tick.birth', '{"interval_hours":6,"rate":0.02}', 'Natives grow by rate of N, capped at max.'),
('tick.conversion', '{"interval_hours":10,"rate":0.01}', 'Natives above the safe floor turn corrupted.'),
('tick.feeding', '{"interval_hours":10,"rate":0.05,"threshold":1.2}', 'Corrupted eat natives above the safe floor when total > threshold * max.'),
('tick.invasion', '{"threshold":1.5,"share":0.7}', 'Invasion when total >= threshold * max and a vice leads.'),
('tick.stronghold_attrition', '{"interval_hours":1,"rate":0.05}', 'Hourly attrition in a stronghold war.'),
('stronghold_conversion_mult', '0.5', 'Conversion rate multiplier inside strongholds.'),
('vice_encounter', '{"base":0.1,"per_dead":0.05,"cap":0.6}', 'Vice encounter chance rises with dead vices.'),

-- Boss and keys (hidden)
('key_weakening', '{"per_key":0.05,"duplicate_falloff":0.5}', 'Carried keys weaken the boss at fight start.'),
('boss_set_weakening', '0.05', 'Permanent shared weakening per consumed key set.'),

-- Loot and essence
('essence_chance', '{"base":0.6,"falloff_per_stat":0.005,"min":0.05}', 'Essence drop chance falls as killed creature stats rise.'),

-- Summoner, dreams, rumors (hidden)
('summoner_exp_bonus', '0.2', 'Hidden move exp bonus while the summoner is in the active party.'),
('summoner_pairing_rule', '"opposite_sex"', 'World rule for summoning.'),
('dream_distance_tiers', '[1,2,5,10]', 'Hex distance tiers for summoner dreams.'),
('rumor_radius', '{"base":1,"per_town_size":1,"per_info_tier":1}', 'Hex radius for hunger rumors.'),

-- Recruiting and capture
('recruit_min_charm', '5', 'Default charm needed to recruit.'),
('recruit_min_favor', '10', 'Default favor needed to recruit.'),
('recruit_min_fame', '0', 'Default fame needed to recruit.'),
('capture_timer', '{"ticks":24}', 'Rescue window in capture-timer ticks.'),
('capture_tick_hours', '1', 'Capture timer tick length before world_time_scale.'),
('party_npc_cap', '3', 'NPC slots in a party.'),

-- Favor (hidden), shown as words
('favor_tiers', '[-50,0,10,30,60,100]', 'Favor value at which each word tier starts.'),

-- Guild
('guild_roster_cap', '8', 'Default guild roster cap.'),
('guild_storage_base_cap', '100', 'Base guild storage weight.'),
('guild_storage_per_warehouse_level', '50', 'Extra storage per warehouse level.'),

-- Crystal ball and trades
('crystal_use_price', '500', 'In-game copper per temple reading.'),
('crystal_bundle_size', '15', 'Paid readings per bundle.'),
('trade_crystal_daily_cap', '5', 'Crystal uses one account can trade away per day.'),
('trade_min_account_age_days', '7', 'Account age before crystal uses can be traded.'),
('trade_timeout_seconds', '60', 'Trade proposal lifetime.'),

-- Presentation
('diegetic_min_lines', '6', 'Startup check: generic lines needed per condition key, tier, and speaker.')
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO social.info_guild_tiers (tier, price, radius_hex, meeting_price) VALUES
(1, 200, 1, 500),
(2, 600, 2, 1200),
(3, 1500, 4, 3000)
ON CONFLICT (tier) DO NOTHING;
