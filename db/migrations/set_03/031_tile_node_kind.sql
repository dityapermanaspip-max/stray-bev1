-- A big obstacle tile can stand for a field's resource node (2026-11-03): node_kind = the node kind it draws (rock, tree,
-- herb, camp, cave). The client draws a node on a flat tile with the catalog's matching obstacle (own biome first, else
-- a row whose biome is 'any'); the server does not care, a node is already a blocked tile.
ALTER TABLE world.tiles ADD COLUMN node_kind text CHECK (node_kind IS NULL OR atlas = 'obstacle');
