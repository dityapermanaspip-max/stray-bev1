-- Town cultures (docs/WORLD.md, Cultures). A culture is the folk of a town: its race, the town field template
-- (which doors it has), the biomes it settles in (best first), and data: specialties (more goods families on top
-- of the biome's), taboo (item types, shapes or goods families its shops never take or stock: elves no meat),
-- jobs (job shares, else world.gen town jobs), pool_weights (template -> weight multiplier for the recruit pool,
-- 0 = never) and visitor_share (share of recruits who are of another race). position orders the cultures; the
-- first is the fallback for a biome no culture names.
CREATE TABLE world.cultures (
  culture_name text PRIMARY KEY,
  race_id uuid NOT NULL REFERENCES entity.races(id),
  town_template text NOT NULL REFERENCES world.field_templates(template_name),
  biomes text[] NOT NULL DEFAULT '{}',
  position integer NOT NULL UNIQUE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE world.towns ADD COLUMN culture text REFERENCES world.cultures(culture_name);

-- What this town's shops refuse (copied from its culture when the town is made).
ALTER TABLE world.town_economy ADD COLUMN taboo text[] NOT NULL DEFAULT '{}';
