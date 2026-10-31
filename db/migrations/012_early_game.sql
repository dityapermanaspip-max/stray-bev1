-- Early game pass: keys leave the item list, gear gets instances, arrival answers.

-- Keys live in the soul (item.keys), never in the item list.
ALTER TABLE item.items DROP CONSTRAINT items_type_check;
ALTER TABLE item.items ADD CONSTRAINT items_type_check
  CHECK (type IN ('scroll','potion','material','weapon','armor','ammo','food','coin','tool'));

-- One row per piece of gear, each with its own durability.
CREATE TABLE item.item_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES item.items(id),
  holder_entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  durability numeric NOT NULL CHECK (durability >= 0),
  equipped_slot text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (holder_entity_id, equipped_slot)
);
CREATE INDEX idx_item_instances_holder ON item.item_instances(holder_entity_id);

-- Hidden effects of arrival answers. Text lives in presentation.diegetic_lines.
CREATE TABLE config.arrival_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_key text NOT NULL,
  question_position integer NOT NULL,
  answer_key text NOT NULL,
  answer_position integer NOT NULL,
  effects jsonb NOT NULL DEFAULT '{}'::jsonb, -- hidden
  UNIQUE (question_key, answer_key),
  UNIQUE (question_key, answer_position)
);
