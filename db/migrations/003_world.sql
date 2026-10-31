CREATE SCHEMA IF NOT EXISTS world;

CREATE TABLE world.rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  seed bigint NOT NULL,
  tick_hours bigint NOT NULL DEFAULT 0, -- world hours run so far (population rules, town ticks)
  tick_at timestamptz -- when the last world hour was due; the server runs due hours with a capped catch-up
);

CREATE TABLE world.kingdoms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES world.rounds(id),
  name text NOT NULL,
  UNIQUE (round_id, name)
);

CREATE TABLE world.hexes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES world.rounds(id),
  q integer NOT NULL,
  r integer NOT NULL,
  ring integer NOT NULL,
  field_kind text NOT NULL CHECK (field_kind IN ('town','open')),
  field_template text NOT NULL,
  field_seed bigint NOT NULL,
  owner_kingdom_id uuid REFERENCES world.kingdoms(id),
  stronghold boolean NOT NULL DEFAULT false,
  defense integer,
  has_temple boolean NOT NULL DEFAULT false,
  has_info_guild boolean NOT NULL DEFAULT false,
  vice_entity_id uuid UNIQUE, -- FK to entity.entities added in 011
  biome text, -- world.biomes name: the field's look
  UNIQUE (round_id, q, r)
);

CREATE TABLE world.borders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES world.rounds(id),
  hex_a uuid NOT NULL REFERENCES world.hexes(id),
  hex_b uuid NOT NULL REFERENCES world.hexes(id),
  corridor_count integer NOT NULL CHECK (corridor_count BETWEEN 3 AND 7),
  UNIQUE (hex_a, hex_b)
);

CREATE TABLE world.corridors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  border_id uuid NOT NULL REFERENCES world.borders(id),
  position integer NOT NULL,
  template text NOT NULL,
  seed bigint NOT NULL,
  owner_kingdom_id uuid REFERENCES world.kingdoms(id),
  feature text NOT NULL DEFAULT 'none' CHECK (feature IN ('none','cave','campfire')),
  UNIQUE (border_id, position)
);

CREATE TABLE world.field_population (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_ref text NOT NULL, -- hex or corridor id as text
  species_id uuid NOT NULL, -- FK to entity.species added in 011
  natural_count integer NOT NULL DEFAULT 0 CHECK (natural_count >= 0),
  corrupted_count integer NOT NULL DEFAULT 0 CHECK (corrupted_count >= 0),
  safe_count integer NOT NULL DEFAULT 0,
  max_count integer NOT NULL DEFAULT 0,
  last_tick bigint NOT NULL DEFAULT 0,
  UNIQUE (field_ref, species_id)
);

CREATE TABLE world.corpses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_ref text NOT NULL,
  species_id uuid NOT NULL, -- FK added in 011
  corrupted boolean NOT NULL DEFAULT false,
  total_stats integer NOT NULL DEFAULT 0,
  ammo_pool jsonb NOT NULL DEFAULT '{}'::jsonb,
  dissected boolean NOT NULL DEFAULT false,
  killed_at timestamptz NOT NULL DEFAULT now() -- rot is worked out from this, never by a timer
);

CREATE TABLE world.vice_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES world.rounds(id),
  vice_type text NOT NULL,
  entity_id uuid NOT NULL UNIQUE, -- FK added in 011
  alive boolean NOT NULL DEFAULT true,
  hex_q integer NOT NULL,
  hex_r integer NOT NULL
);

CREATE TABLE world.boss_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL UNIQUE REFERENCES world.rounds(id),
  entity_id uuid NOT NULL, -- FK added in 011
  key_weakening numeric NOT NULL DEFAULT 0, -- hidden
  attempts integer NOT NULL DEFAULT 0
);

CREATE TABLE world.invasions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES world.rounds(id),
  vice_entity_id uuid NOT NULL, -- FK added in 011
  from_hex uuid NOT NULL REFERENCES world.hexes(id),
  to_hex uuid NOT NULL REFERENCES world.hexes(id),
  invader_count integer NOT NULL DEFAULT 0,
  defender_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active'
);

CREATE TABLE world.invasion_contrib (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invasion_id uuid NOT NULL REFERENCES world.invasions(id),
  entity_id uuid NOT NULL, -- FK added in 011
  score integer NOT NULL DEFAULT 0,
  UNIQUE (invasion_id, entity_id)
);

CREATE TABLE world.summoning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES world.rounds(id),
  summoner_entity_id uuid NOT NULL, -- FK added in 011
  bound_player_entity_id uuid, -- hidden, FK added in 011
  region_ref text NOT NULL,
  failed boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Fields. A field is generated from template + biome + seed, never stored tile by tile.
-- Template = shape (kind, size, exits, town layout). Biome = look (ground terrains, obstacles, hills).
-- A corridor blends the biomes of the two hexes it joins, shifting along its length.
CREATE TABLE world.field_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('open','corridor','town')),
  width integer NOT NULL CHECK (width BETWEEN 4 AND 64),
  height integer NOT NULL CHECK (height BETWEEN 4 AND 64),
  params jsonb NOT NULL DEFAULT '{}'::jsonb -- obstacle_mult, edge_margin, town
);

CREATE TABLE world.biomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  biome_name text NOT NULL UNIQUE,
  params jsonb NOT NULL DEFAULT '{}'::jsonb -- ground {terrain: weight}, obstacles {terrain: weight}, obstacle_density, hills {max, scale}
);

-- Where each entity stands. Saved on stop, travel, leave and disconnect, never per step.
CREATE TABLE world.entity_positions (
  entity_id uuid PRIMARY KEY, -- FK added in 011
  field_ref text NOT NULL, -- hex or corridor id as text
  x integer NOT NULL,
  y integer NOT NULL,
  wake_ref text, -- the last town entered (hex id as text): where they wake after passing out; null = none yet
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Town economy: a shop purse, a ceiling on what the villagers pay for one thing, specialty goods, craftsman levels,
-- a population with job shares, and a stock count per item and quality. Prices are never stored: they follow stock.
CREATE TABLE world.town_economy (
  town_ref text PRIMARY KEY, -- hex id as text
  purse integer NOT NULL CHECK (purse >= 0), -- copper the shop can spend
  max_buy integer NOT NULL CHECK (max_buy >= 0), -- the shop never pays more than this for one item
  specialties text[] NOT NULL DEFAULT '{}', -- item goods families made here (wood, chicken, ...)
  facilities jsonb NOT NULL DEFAULT '{}'::jsonb, -- craftsman service -> level (missing = 1)
  population integer NOT NULL DEFAULT 0 CHECK (population >= 0), -- the base of the town tick math
  jobs jsonb NOT NULL DEFAULT '{}'::jsonb -- job -> share of the workforce (hunter, woodcutter, cook, farmer, ...)
);

CREATE TABLE world.town_stock (
  town_ref text NOT NULL REFERENCES world.town_economy(town_ref) ON DELETE CASCADE,
  item_id uuid NOT NULL, -- FK added in 011
  quality text NOT NULL DEFAULT 'common',
  qty integer NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (town_ref, item_id, quality)
);