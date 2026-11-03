-- Favor ladder and names. All hidden: nothing here reaches the client as a number.
-- npc_standing: each NPC's own base favor threshold (T), rolled once from its role (config standing.ladder.roles).
CREATE TABLE social.npc_standing (
  entity_id uuid PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,
  base_threshold integer NOT NULL CHECK (base_threshold > 0)
);

-- talk_log: favor-giving contacts (talk, shop, services) with one NPC in one world tick; the cap is in config.
CREATE TABLE social.talk_log (
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  tick integer NOT NULL,
  count integer NOT NULL,
  PRIMARY KEY (entity_id, target_id)
);

-- gift_log: the last gift to one NPC (one per real day).
CREATE TABLE social.gift_log (
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  last_gift_at timestamptz NOT NULL,
  PRIMARY KEY (entity_id, target_id)
);

-- name_parts: the name generator's pools. first_m / first_f / last by race. A middle name is drawn from the race's
-- first names, and only notables and their descendants have one.
CREATE TABLE entity.name_parts (
  race_name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('first_m', 'first_f', 'last')),
  name text NOT NULL,
  PRIMARY KEY (race_name, kind, name)
);
