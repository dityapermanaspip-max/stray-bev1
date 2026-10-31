-- Loot (Step 1.8): carcasses carry hidden data, stacks keep their quality, field corpses rot from their kill time.

-- Per-piece data, e.g. a carcass: {species, corrupted, total_stats, killed_at}. Hidden, server only.
ALTER TABLE item.item_instances ADD COLUMN data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Stacks of different quality never merge (essence, crafting materials).
ALTER TABLE item.inventory ADD COLUMN quality text NOT NULL DEFAULT 'common';
ALTER TABLE item.inventory DROP CONSTRAINT inventory_entity_id_item_id_key;
ALTER TABLE item.inventory ADD CONSTRAINT inventory_entity_item_quality_unique UNIQUE (entity_id, item_id, quality);

ALTER TABLE item.items DROP CONSTRAINT items_type_check;
ALTER TABLE item.items ADD CONSTRAINT items_type_check
  CHECK (type IN ('scroll','potion','material','weapon','armor','accessory','clothing','ammo','food','coin','tool','carcass','part','essence'));

-- A carcass nobody could carry stays where it fell. Rot is worked out from killed_at, never by a timer.
ALTER TABLE world.corpses ADD COLUMN killed_at timestamptz NOT NULL DEFAULT now();
