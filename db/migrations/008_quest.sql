CREATE SCHEMA IF NOT EXISTS quest;

CREATE TABLE quest.quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, -- tide, reclaim, rebuild, rescue, defense
  trigger_event text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  rewards jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_quest_id uuid REFERENCES quest.quests(id)
);

CREATE TABLE quest.quest_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  quest_id uuid NOT NULL REFERENCES quest.quests(id),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','done','failed','expired')),
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  UNIQUE (entity_id, quest_id)
);

-- Captives are only held, then devoured or released. No other fate exists.
CREATE TABLE quest.captives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL UNIQUE REFERENCES entity.entities(id),
  held_by_entity_id uuid NOT NULL REFERENCES entity.entities(id),
  location_ref text NOT NULL,
  expires_at_tick bigint NOT NULL,
  quest_id uuid REFERENCES quest.quests(id)
);

CREATE TABLE quest.dispatch_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_name text NOT NULL UNIQUE,
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
  move_exp_reward jsonb NOT NULL DEFAULT '{}'::jsonb,
  min_favor numeric NOT NULL DEFAULT 0
);

-- Resolved on collection, never by a timer.
CREATE TABLE quest.dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entity.entities(id),
  quest_id uuid NOT NULL REFERENCES quest.dispatch_quests(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  collected boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_quest_progress_entity ON quest.quest_progress(entity_id);
CREATE INDEX idx_dispatches_entity ON quest.dispatches(entity_id);
