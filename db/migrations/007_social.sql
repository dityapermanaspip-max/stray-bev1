CREATE SCHEMA IF NOT EXISTS social;

CREATE TABLE social.favor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  favor numeric NOT NULL DEFAULT 0, -- hidden
  UNIQUE (entity_id, target_id)
);

CREATE TABLE social.favor_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  tier text NOT NULL,
  claimed boolean NOT NULL DEFAULT false,
  UNIQUE (entity_id, target_id, tier)
);

CREATE TABLE social.parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES world.rounds(id),
  player_entity_id uuid NOT NULL UNIQUE REFERENCES entity.entities(id)
);

CREATE TABLE social.party_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES social.parties(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL UNIQUE REFERENCES entity.entities(id),
  slot integer NOT NULL CHECK (slot BETWEEN 1 AND 3),
  UNIQUE (party_id, slot)
);

CREATE TABLE social.recruit_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES world.rounds(id),
  entity_id uuid NOT NULL UNIQUE REFERENCES entity.entities(id),
  town_hex_ref text NOT NULL,
  spot text NOT NULL CHECK (spot IN ('tavern','inn','shop','training_ground','campfire')),
  offers_hire boolean NOT NULL DEFAULT false,
  hire_fee integer CHECK (hire_fee >= 0), -- copper
  contract_type text CHECK (contract_type IN ('travel','quest')),
  contract_target text
);

CREATE TABLE social.guilds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account_id uuid NOT NULL REFERENCES account.accounts(id),
  roster_cap integer NOT NULL
);

CREATE TABLE social.guild_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES social.guilds(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL UNIQUE REFERENCES entity.entities(id)
);

CREATE TABLE social.guild_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES social.guilds(id) ON DELETE CASCADE,
  type text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  UNIQUE (guild_id, type)
);

CREATE TABLE social.guild_storage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES social.guilds(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES item.items(id),
  qty integer NOT NULL CHECK (qty > 0),
  UNIQUE (guild_id, item_id)
);

-- Resolved on collection, never by a timer.
CREATE TABLE social.crafting_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES social.guilds(id),
  facility_type text NOT NULL,
  entity_id uuid NOT NULL REFERENCES entity.entities(id),
  recipe_id uuid NOT NULL REFERENCES item.recipes(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  collected boolean NOT NULL DEFAULT false
);

CREATE TABLE social.crystal_ball_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entity.entities(id),
  hex_ref text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  free boolean NOT NULL DEFAULT false,
  granted_by text, -- first_visit, favor tier, paid
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE social.info_guild_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier integer NOT NULL UNIQUE,
  price integer NOT NULL,
  radius_hex integer NOT NULL,
  meeting_price integer NOT NULL
);

CREATE INDEX idx_favor_entity_target ON social.favor(entity_id, target_id);
CREATE INDEX idx_recruit_pool_town ON social.recruit_pool(town_hex_ref);
