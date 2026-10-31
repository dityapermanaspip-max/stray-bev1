-- Standing: favor is personal (social.favor, one NPC), fame is per town. Both, with charm, gate talk options.
-- All values here are hidden: they never reach the client.

-- The NPC behind a town door (shopkeeper, craftsman): the target of favor. Made on first need.
CREATE TABLE world.town_keepers (
  town_ref text NOT NULL, -- hex id as text
  service text NOT NULL,
  entity_id uuid NOT NULL UNIQUE REFERENCES entity.entities(id) ON DELETE CASCADE,
  PRIMARY KEY (town_ref, service)
);

-- A player's current town visit. A new one starts on entering a town after leaving one (a reload is the same visit).
CREATE TABLE world.town_visits (
  entity_id uuid PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,
  town_ref text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz -- null while still in the town
);

-- Fame per player per town (town hexes belong to one round). A deed adds full fame where it happened and less in
-- towns nearby, falling off with distance.
CREATE TABLE world.town_fame (
  town_ref text NOT NULL,
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  fame numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (town_ref, entity_id)
);

-- Trade standing with one NPC: the visit of the last haggle (one per visit) and its outcome, and the pushover mark.
CREATE TABLE social.trade_standing (
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  haggle_visit timestamptz, -- town_visits.started_at of the visit the last haggle was in
  haggle_won boolean NOT NULL DEFAULT false,
  pushover_until timestamptz, -- worse prices and haggle odds with this NPC until then
  PRIMARY KEY (entity_id, target_id)
);
