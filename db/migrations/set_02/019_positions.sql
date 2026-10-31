-- Where each entity stands in the world (Step 2b). Saved on stop, travel, leave and disconnect, never per step.
CREATE TABLE world.entity_positions (
  entity_id uuid PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,
  field_ref text NOT NULL, -- hex or corridor id as text
  x integer NOT NULL,
  y integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_entity_positions_field ON world.entity_positions(field_ref);
