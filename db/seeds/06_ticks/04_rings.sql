-- Pilot ring ladder (4 rings; the full season is set later). Hidden. Ring 4 is the outer ring, ring 1 the vices',
-- the boss hex is ring 0. Creatures roughly double in total core stats each ring inward; a player needs about the
-- ring's total to hunt its regular creatures. Corrupted creatures never breed: they only come from conversion.
INSERT INTO config.balance_config (config_key, value, description) VALUES
('world.rings', '{"count":4,"creature_total":{"4":[15,3],"3":[30,5],"2":[60,8],"1":[100,11]},"vice_bonus":30,"boss_total":250,
  "conversion_per_ring":0.008,"start_fill":{"outer":[0.1,0.5],"per_ring":0.05}}',
 'Ring ladder: creature_total[ring] = [mean, spread] of regular creatures'' total core stats; vices vice_bonus above their ring; the boss boss_total; conversion = tick.conversion.rate at the outer ring + conversion_per_ring per ring closer; a hex''s natives start at a random share of max in start_fill.outer + per_ring per ring closer.')
ON CONFLICT (config_key) DO NOTHING;

-- Births steady over the whole map. With conversion rising inward, a dense hex left alone tides in about 9-13 days,
-- a thin one in 3-8 weeks; inner hexes start denser.
UPDATE config.balance_config SET value = '{"interval_hours":6,"rate":0.03}', updated_at = now(),
  description = 'Natives grow by rate x natives every interval_hours, the same on every ring, capped at max.'
WHERE config_key = 'tick.birth';
UPDATE config.balance_config SET value = '{"interval_hours":10,"rate":0.01}', updated_at = now(),
  description = 'Natives above the safe floor turn corrupted at rate x natives every interval_hours on the outer ring; world.rings adds conversion_per_ring per ring closer to the centre.'
WHERE config_key = 'tick.conversion';

-- The starting species are outer-ring creatures (15 +- 3), and the dev world's hexes sit on the outer ring.
UPDATE entity.species SET ring_min = 4, ring_max = 4 WHERE species_name IN ('chicken', 'lizard', 'cat');
UPDATE world.hexes h SET ring = 4 FROM world.rounds r WHERE r.id = h.round_id AND r.status = 'dev';
