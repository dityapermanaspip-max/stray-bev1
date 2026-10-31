CREATE SCHEMA IF NOT EXISTS world;

CREATE TABLE world.rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  seed bigint NOT NULL
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
  dissected boolean NOT NULL DEFAULT false
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