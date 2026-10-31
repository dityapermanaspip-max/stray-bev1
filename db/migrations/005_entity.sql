CREATE SCHEMA IF NOT EXISTS entity;

CREATE TABLE entity.races (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_name text NOT NULL UNIQUE,
  body_parts text[] NOT NULL DEFAULT '{}',
  stat_mods jsonb NOT NULL DEFAULT '{}'::jsonb,
  size text NOT NULL DEFAULT 'medium'
);

CREATE TABLE entity.traits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trait_name text NOT NULL UNIQUE,
  modifiers jsonb NOT NULL DEFAULT '{}'::jsonb, -- hidden
  hidden boolean NOT NULL DEFAULT true
);

CREATE TABLE entity.species (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species_name text NOT NULL UNIQUE,
  base_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_parts text[] NOT NULL DEFAULT '{}',
  ring_min integer NOT NULL DEFAULT 1,
  ring_max integer NOT NULL DEFAULT 4,
  loot_table_native uuid, -- FK to item.loot_tables added in 011
  loot_table_corrupted uuid,
  on_expiry text NOT NULL DEFAULT 'ignore' CHECK (on_expiry IN ('devour','ignore'))
);

CREATE TABLE entity.species_moves (
  species_id uuid NOT NULL REFERENCES entity.species(id) ON DELETE CASCADE,
  move_id uuid NOT NULL REFERENCES moves.moves(id),
  PRIMARY KEY (species_id, move_id)
);

CREATE TABLE entity.entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('player','native','named','boss','recruit','summoner')),
  name text NOT NULL,
  round_id uuid REFERENCES world.rounds(id),
  location_ref text,
  row text NOT NULL DEFAULT 'front' CHECK (row IN ('front','back')),
  account_id uuid REFERENCES account.accounts(id),
  kingdom_id uuid REFERENCES world.kingdoms(id),
  recruited_by uuid REFERENCES entity.entities(id),
  species_id uuid REFERENCES entity.species(id),
  race_id uuid REFERENCES entity.races(id),
  portrait_id uuid, -- FK to presentation.portraits added in 011
  body_type text CHECK (body_type IN ('male','female')),
  element_slots integer NOT NULL DEFAULT 1, -- hidden
  fame integer NOT NULL DEFAULT 0, -- hidden
  first_temple_used boolean NOT NULL DEFAULT false,
  summoner_id uuid REFERENCES entity.entities(id),
  is_summoner boolean NOT NULL DEFAULT false,
  alive boolean NOT NULL DEFAULT true,
  died_at timestamptz
);

CREATE TABLE entity.entity_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  stat text NOT NULL CHECK (stat IN ('str','dex','int','end','luck','charm')),
  base numeric NOT NULL DEFAULT 1,
  exp numeric NOT NULL DEFAULT 0,
  UNIQUE (entity_id, stat)
);

CREATE TABLE entity.entity_affinity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  element text NOT NULL,
  value numeric NOT NULL DEFAULT 0, -- hidden
  UNIQUE (entity_id, element)
);

CREATE TABLE entity.element_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  element_a text NOT NULL,
  element_b text NOT NULL,
  penalty numeric NOT NULL DEFAULT 0,
  UNIQUE (element_a, element_b)
);

CREATE TABLE entity.entity_traits (
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  trait_id uuid NOT NULL REFERENCES entity.traits(id),
  PRIMARY KEY (entity_id, trait_id)
);

CREATE TABLE entity.entity_personality (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  tag text NOT NULL,
  set_by text NOT NULL DEFAULT 'creation' CHECK (set_by IN ('creation','event')),
  UNIQUE (entity_id, tag)
);

CREATE TABLE entity.resistances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_kind text NOT NULL CHECK (owner_kind IN ('species','item','race')),
  owner_id uuid NOT NULL, -- polymorphic, no FK
  target_kind text NOT NULL CHECK (target_kind IN ('damage_type','element','status')),
  target_id text NOT NULL, -- damage_type_name, element, or status_name
  mult numeric NOT NULL DEFAULT 1 CHECK (mult >= 0),
  UNIQUE (owner_kind, owner_id, target_kind, target_id)
);

CREATE INDEX idx_entities_account ON entity.entities(account_id);
CREATE INDEX idx_entities_location ON entity.entities(location_ref);
CREATE INDEX idx_entity_stats_entity ON entity.entity_stats(entity_id);