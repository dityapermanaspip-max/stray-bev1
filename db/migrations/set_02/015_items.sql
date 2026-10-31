-- Inventory and gear (Step 1.7). An item row is one shape plus one core material; the material names it.

CREATE TABLE item.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_name text NOT NULL UNIQUE,
  tags text[] NOT NULL DEFAULT '{}', -- metal, leather, cloth, wood, stone...
  data jsonb NOT NULL DEFAULT '{}'::jsonb -- set_defense, set_weight (full armor set), durability (per piece)
);

ALTER TABLE item.items ADD COLUMN shape text;
ALTER TABLE item.items ADD COLUMN core_material_id uuid REFERENCES item.materials(id);
ALTER TABLE item.items ADD CONSTRAINT items_shape_material_unique UNIQUE (shape, core_material_id);

ALTER TABLE item.items DROP CONSTRAINT items_type_check;
ALTER TABLE item.items ADD CONSTRAINT items_type_check
  CHECK (type IN ('scroll','potion','material','weapon','armor','accessory','clothing','ammo','food','coin','tool'));

-- Quality belongs to the piece, not the item row.
ALTER TABLE item.item_instances ADD COLUMN quality text NOT NULL DEFAULT 'common';

-- A wieldable stack (stones, sticks) can be readied in a hand slot.
ALTER TABLE item.inventory ADD COLUMN equipped_slot text;
ALTER TABLE item.inventory ADD CONSTRAINT inventory_entity_slot_unique UNIQUE (entity_id, equipped_slot);

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
