-- Vices (hidden): one type per core stat. When the last living vice of a type dies, a new one of that type is born at
-- once in the most corrupted vice-free wild hex. Finding one is hard: rumors, and find_permille of the encounters in
-- its hex are the vice itself (wired with the vice fight step). Stats: ring creature total + world.rings vice_bonus,
-- the type's stat weighted main_weight against 1 for each other stat.
INSERT INTO config.balance_config (config_key, value, description) VALUES
('vice', '{"types":["str","dex","int","end","luck","charm"],"main_weight":2,"find_permille":20}',
 'Vice types (one per core stat); main_weight of the type''s stat in a vice''s stat split; find_permille: chance an encounter in a vice''s hex is the vice.')
ON CONFLICT (config_key) DO NOTHING;
