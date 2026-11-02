-- How regular creatures are rolled per ring (ring 4 is the outer one). Hidden.
INSERT INTO config.balance_config (config_key, value, description) VALUES
('creature.gen', '{"stat_range":{"4":[2,3],"3":[5,10],"2":[12,17],"1":[20,27]},
  "move_budget":{"4":10,"3":30,"2":50,"1":80},
  "die":{"4":10,"3":25,"2":25,"1":25},
  "max_move_level":25, "corrupted_stat_mult":1.2, "corrupted_budget_per_step":10}',
 'Regular creatures per ring: core stat range (main stats in its upper half), total move levels handed out by die rolls over the species move pool, the die, the move level cap, and the corrupted bonus (stats x mult, budget + per_step for each ring from the outside).')
ON CONFLICT (config_key) DO NOTHING;

-- Vices are their ring's creature total + vice_bonus: totals follow the new stat ranges (6 stats, main stats high).
UPDATE config.balance_config SET value = jsonb_set(value, '{creature_total}', '{"4":[15,3],"3":[47,15],"2":[89,15],"1":[143,21]}')
WHERE config_key = 'world.rings';

UPDATE entity.species s SET main_stats = m.stats FROM (VALUES
  ('chicken', ARRAY['dex','luck']), ('lizard', ARRAY['dex','end']), ('cat', ARRAY['dex','luck']),
  ('ostrich', ARRAY['dex','str']), ('bull', ARRAY['end','str']), ('bear', ARRAY['str','end'])
) AS m(name, stats) WHERE s.species_name = m.name;
