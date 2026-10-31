-- Fields (Step 2a). A field is generated from template + biome + seed, never stored tile by tile.
-- Template = shape (kind, size, exits). Biome = look (ground terrains, obstacles, hills).
-- A corridor blends the biomes of the two hexes it joins, shifting along its length.

CREATE TABLE world.field_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('open','corridor','town')),
  width integer NOT NULL CHECK (width BETWEEN 4 AND 64),
  height integer NOT NULL CHECK (height BETWEEN 4 AND 64),
  params jsonb NOT NULL DEFAULT '{}'::jsonb -- obstacle_mult, edge_margin
);

CREATE TABLE world.biomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  biome_name text NOT NULL UNIQUE,
  params jsonb NOT NULL DEFAULT '{}'::jsonb -- ground {terrain: weight}, obstacles {terrain: weight}, obstacle_density, hills {max, scale}
);

ALTER TABLE world.hexes ADD COLUMN biome text;
