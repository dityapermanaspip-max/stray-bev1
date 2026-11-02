-- Trait quota roll: each trait costs part of a rolled quota; weight is how often it comes up among those that fit.
ALTER TABLE entity.traits ADD COLUMN IF NOT EXISTS cost integer NOT NULL DEFAULT 0;
ALTER TABLE entity.traits ADD COLUMN IF NOT EXISTS weight integer NOT NULL DEFAULT 1;
