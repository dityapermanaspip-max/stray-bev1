CREATE SCHEMA IF NOT EXISTS item;

-- One shape plus one core material per item row; the material names the item.
CREATE TABLE item.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_name text NOT NULL UNIQUE,
  tags text[] NOT NULL DEFAULT '{}', -- metal, leather, cloth, wood, stone...
  data jsonb NOT NULL DEFAULT '{}'::jsonb -- set_defense, set_weight (full armor set), durability (per piece)
);

-- Keys are not items: they live in the soul (item.keys).
CREATE TABLE item.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL UNIQUE,
  type text NOT NULL CONSTRAINT items_type_check
    CHECK (type IN ('scroll','potion','material','weapon','armor','accessory','clothing','ammo','food','coin','tool','carcass','part','essence')),
  shape text,
  core_material_id uuid REFERENCES item.materials(id),
  data jsonb NOT NULL DEFAULT '{}'::jsonb, -- weight, value, goods, grants_move, weapon and armor fields, ...
  CONSTRAINT items_shape_material_unique UNIQUE (shape, core_material_id)
);

-- Stacks. Different qualities never merge. A wieldable stack (stones, sticks) can be readied in a hand slot.
CREATE TABLE item.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES item.items(id),
  qty integer NOT NULL CHECK (qty > 0),
  quality text NOT NULL DEFAULT 'common',
  equipped_slot text,
  CONSTRAINT inventory_entity_item_quality_unique UNIQUE (entity_id, item_id, quality),
  CONSTRAINT inventory_entity_slot_unique UNIQUE (entity_id, equipped_slot)
);

-- One row per piece (gear, carcasses), each with its own durability, quality and hidden data
-- (a carcass: {species, corrupted, total_stats, killed_at}).
CREATE TABLE item.item_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES item.items(id),
  holder_entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  durability numeric NOT NULL CHECK (durability >= 0),
  equipped_slot text,
  quality text NOT NULL DEFAULT 'common',
  data jsonb NOT NULL DEFAULT '{}'::jsonb, -- hidden, server only
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (holder_entity_id, equipped_slot)
);

-- Item effects mirror move_effects, plus a trigger. Run by the same effect handlers.
CREATE TABLE item.item_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES item.items(id) ON DELETE CASCADE,
  position integer NOT NULL,
  trigger text NOT NULL CHECK (trigger IN ('worn','on_hit','on_struck','on_dodge','used')),
  effect_type_id uuid NOT NULL REFERENCES moves.effect_types(id),
  power numeric NOT NULL DEFAULT 0,
  duration_turns integer,
  chance numeric NOT NULL DEFAULT 1 CHECK (chance > 0 AND chance <= 1),
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (item_id, position)
);

-- Items an entity has worn or used. Their effect sentences show only after that.
CREATE TABLE item.known_items (
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES item.items(id),
  learned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_id, item_id)
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

-- A loot table groups entries; species and vices point at the table. Chances are out of 1000 (luck adds per-mille).
CREATE TABLE item.loot_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL UNIQUE,
  owner text NOT NULL CHECK (owner IN ('species','vice','boss'))
);

CREATE TABLE item.loot_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loot_table_id uuid NOT NULL REFERENCES item.loot_tables(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES item.items(id),
  chance_permille integer NOT NULL CONSTRAINT loot_entries_permille_check CHECK (chance_permille BETWEEN 1 AND 1000),
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

-- One recipe table: town craftsmen (facility_type = the town service, level from town_economy.facilities), later
-- guild facilities and player crafting. inputs and outputs: [{item, qty}] by item name.
CREATE TABLE item.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_name text NOT NULL UNIQUE,
  facility_type text NOT NULL,
  min_facility_level integer NOT NULL DEFAULT 1,
  inputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  outputs jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE item.recipe_requires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES item.recipes(id) ON DELETE CASCADE,
  skill_move_id uuid NOT NULL REFERENCES moves.moves(id),
  min_skill_level integer NOT NULL DEFAULT 1,
  UNIQUE (recipe_id, skill_move_id)
);

CREATE INDEX idx_inventory_entity ON item.inventory(entity_id);
CREATE INDEX idx_item_instances_holder ON item.item_instances(holder_entity_id);
CREATE INDEX idx_keys_holder ON item.keys(holder_entity_id);
CREATE INDEX idx_loot_entries_table ON item.loot_entries(loot_table_id);
