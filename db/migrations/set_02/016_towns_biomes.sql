-- A town is its own field inside its hex: the hex is an open field with a small walled town and a gate in the
-- middle; the gate leads into the town field (its own template and seed). Town rows (economy, stock, keepers,
-- visits, fame, wake spots) are keyed by the town's id as text, like every field ref.
-- A hex with field_kind 'town' is a hex that holds a town.
CREATE TABLE world.towns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES world.rounds(id),
  hex_id uuid NOT NULL UNIQUE REFERENCES world.hexes(id) ON DELETE CASCADE,
  template text NOT NULL,
  seed bigint NOT NULL
);

-- Which species live in a biome, and how many of each (weights split a hex's creature cap). The ring only decides
-- how strong they are (config creature.gen), so a ring 1 meadow holds very strong chickens.
CREATE TABLE world.biome_species (
  biome_id uuid NOT NULL REFERENCES world.biomes(id) ON DELETE CASCADE,
  species_id uuid NOT NULL REFERENCES entity.species(id) ON DELETE CASCADE,
  weight integer NOT NULL CHECK (weight > 0),
  PRIMARY KEY (biome_id, species_id)
);

-- A variant (snow bear, a special monster of a special hex) is its own species; left-empty move pool, main stats and
-- body parts come from the species it is a variant of.
ALTER TABLE entity.species ADD COLUMN variant_of uuid REFERENCES entity.species(id);
