CREATE SCHEMA IF NOT EXISTS item;

CREATE TABLE item.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('scroll','potion','key','material','weapon','ammo','food','coin')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb -- bound, weight, grants_move_id, weapon fields
);

CREATE TABLE item.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES item.items(id),
  qty integer NOT NULL CHECK (qty > 0),
  UNIQUE (entity_id, item_id)
);

-- Keys are always bound: never traded, wagered, or auctioned.
CREATE TABLE item.keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES world.rounds(id),
  vice_type text NOT NULL,
  holder_entity_id uuid NOT NULL REFERENCES entity.entities(id),
  bound boolean NOT NULL DEFAULT true CHECK (bound),
  source text NOT NULL CHECK (source IN ('vice_kill','quest','tournament')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A loot table groups entries; species and vices point at the table.
CREATE TABLE item.loot_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL UNIQUE,
  owner text NOT NULL CHECK (owner IN ('species','vice','boss'))
);

CREATE TABLE item.loot_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loot_table_id uuid NOT NULL REFERENCES item.loot_tables(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES item.items(id),
  chance numeric NOT NULL CHECK (chance > 0 AND chance <= 1),
  min_qty integer NOT NULL DEFAULT 1 CHECK (min_qty >= 1),
  max_qty integer NOT NULL DEFAULT 1,
  CHECK (max_qty >= min_qty),
  UNIQUE (loot_table_id, item_id)
);

CREATE TABLE item.essence_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier text NOT NULL UNIQUE,
  min_total_stats integer NOT NULL,
  item_id uuid NOT NULL REFERENCES item.items(id)
);

CREATE TABLE item.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id uuid NOT NULL REFERENCES entity.entities(id),
  to_entity_id uuid NOT NULL REFERENCES entity.entities(id),
  field_ref text NOT NULL,
  offer jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected','expired')),
  expires_at timestamptz NOT NULL
);

CREATE TABLE item.duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parties jsonb NOT NULL DEFAULT '[]'::jsonb,
  stake jsonb NOT NULL DEFAULT '{}'::jsonb, -- items and money only, never keys
  state text NOT NULL DEFAULT 'open'
);

CREATE TABLE item.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_name text NOT NULL UNIQUE,
  facility_type text NOT NULL,
  min_facility_level integer NOT NULL DEFAULT 1,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  outputs jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE item.recipe_requires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES item.recipes(id) ON DELETE CASCADE,
  skill_move_id uuid NOT NULL REFERENCES moves.moves(id),
  min_skill_level integer NOT NULL DEFAULT 1,
  UNIQUE (recipe_id, skill_move_id)
);

CREATE INDEX idx_inventory_entity ON item.inventory(entity_id);
CREATE INDEX idx_keys_holder ON item.keys(holder_entity_id);
CREATE INDEX idx_loot_entries_table ON item.loot_entries(loot_table_id);
