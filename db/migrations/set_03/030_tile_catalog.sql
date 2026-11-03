-- Tile catalog (2026-11-03): one row per drawn tile, in three atlases: walk (floor you can stand on), block (flat ground
-- you cannot walk on: water, walls) and obstacle (an object tile: well, tent, fireplace). The server names what a tile
-- is (terrain); the catalog says which drawings stand for that terrain, with weights. Edge pieces (shores, banks) are
-- rows too: edge = the side or corner of the tile where the neighbour terrain edge_of lies (ul ur lr ll, corners top
-- right bottom left). A mirror row has no art of its own: it is its source flipped left-right.
-- `sheet` + `cell`: where the art is, a PNG under public/assets/world/tiles/catalog/sheets, cell in reading order.
CREATE TABLE world.tiles (
  tile_key    text PRIMARY KEY,
  atlas       text NOT NULL CHECK (atlas IN ('walk', 'block', 'obstacle')),
  terrain     text NOT NULL,
  biome       text NOT NULL DEFAULT 'any',
  walkable    boolean NOT NULL,
  sheet       text,
  cell        integer CHECK (cell >= 0),
  mirror_of   text REFERENCES world.tiles (tile_key),
  edge        text CHECK (edge IN ('ul', 'ur', 'lr', 'll', 'top', 'right', 'bottom', 'left')),
  edge_of     text,
  weight      integer NOT NULL DEFAULT 1 CHECK (weight > 0),
  description text NOT NULL DEFAULT '',
  CHECK ((atlas = 'walk') = walkable),
  CHECK ((mirror_of IS NULL) = (sheet IS NOT NULL AND cell IS NOT NULL)),
  CHECK ((edge IS NULL) = (edge_of IS NULL))
);
CREATE INDEX tiles_terrain ON world.tiles (terrain);
