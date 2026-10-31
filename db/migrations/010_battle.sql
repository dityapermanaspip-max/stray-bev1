CREATE SCHEMA IF NOT EXISTS battle;

-- Entity move knowledge. Life skills use known_moves too.
CREATE TABLE entity.known_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  move_id uuid NOT NULL REFERENCES moves.moves(id),
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  exp numeric NOT NULL DEFAULT 0 CHECK (exp >= 0),
  seen boolean NOT NULL DEFAULT false,
  UNIQUE (entity_id, move_id)
);

CREATE TABLE entity.known_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  move_id uuid NOT NULL REFERENCES moves.moves(id),
  UNIQUE (entity_id, move_id)
);

-- Slot range is checked against balance_config loadout_slots by the server.
CREATE TABLE entity.loadouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,
  slot integer NOT NULL CHECK (slot >= 1),
  move_id uuid NOT NULL REFERENCES moves.moves(id),
  UNIQUE (entity_id, slot),
  UNIQUE (entity_id, move_id)
);

CREATE TABLE battle.battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid REFERENCES world.rounds(id),
  party_id uuid REFERENCES social.parties(id),
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE battle.battle_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES battle.battles(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entity.entities(id),
  atb numeric NOT NULL DEFAULT 0,
  hp numeric NOT NULL,
  stamina numeric NOT NULL,
  mana numeric NOT NULL,
  row text NOT NULL DEFAULT 'front' CHECK (row IN ('front','back')),
  downed boolean NOT NULL DEFAULT false,
  ammo_fired jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (battle_id, entity_id)
);

CREATE TABLE battle.active_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES battle.battles(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entity.entities(id),
  type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  remaining_turns integer
);

CREATE INDEX idx_known_moves_entity ON entity.known_moves(entity_id);
CREATE INDEX idx_active_effects_battle ON battle.active_effects(battle_id, entity_id);
