-- What a trait rolled for this one entity (an element trait's elements, a ward's element). Hidden.
ALTER TABLE entity.entity_traits ADD COLUMN IF NOT EXISTS params jsonb NOT NULL DEFAULT '{}'::jsonb;
