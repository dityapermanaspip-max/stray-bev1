-- Resource nodes and meals.
-- Nodes are placed by the field seed (never stored); only how much of each has been taken is. The world tick
-- gives some back every world hour; a row at 0 is deleted. Shared by every player in the field.
CREATE TABLE world.field_nodes (
  field_ref text NOT NULL,
  node int NOT NULL,
  kind text NOT NULL,
  taken int NOT NULL DEFAULT 0 CHECK (taken >= 0),
  PRIMARY KEY (field_ref, node)
);

-- One meal at a time per entity (a new one replaces it). Its hidden effect lasts from eaten_at for the configured
-- time; nothing ticks it down.
CREATE TABLE entity.meals (
  entity_id uuid PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES item.items(id),
  eaten_at timestamptz NOT NULL DEFAULT now()
);

-- Node finds come from loot tables too (node_<kind>_native / _corrupted).
ALTER TABLE item.loot_tables DROP CONSTRAINT loot_tables_owner_check;
ALTER TABLE item.loot_tables ADD CONSTRAINT loot_tables_owner_check CHECK (owner IN ('species','vice','boss','node'));
