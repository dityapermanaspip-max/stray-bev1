CREATE SCHEMA IF NOT EXISTS moves;

CREATE TABLE moves.damage_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  damage_type_name text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('physical','magic'))
);

CREATE TABLE moves.effect_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effect_name text NOT NULL UNIQUE,
  handler_key text NOT NULL
);

CREATE TABLE moves.moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_name text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category IN ('attack','guard','heal','buff','debuff','control','life')),
  damage_type_id uuid REFERENCES moves.damage_types(id),
  element text,
  resource text CHECK (resource IN ('stamina','mana')),
  cost numeric NOT NULL DEFAULT 0,
  target text NOT NULL CHECK (target IN ('self','one_enemy','enemy_row','all_enemies','one_ally','all_allies')),
  row_rule text NOT NULL DEFAULT 'front',
  atb_windup numeric NOT NULL DEFAULT 0,
  atb_recovery numeric NOT NULL DEFAULT 0,
  channel boolean NOT NULL DEFAULT false,
  exp_scaling numeric,
  damage_per_level numeric, -- null = growth tag config rate
  recovery_per_level numeric,
  cost_per_level numeric
);

CREATE TABLE moves.move_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id uuid NOT NULL REFERENCES moves.moves(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  effect_type_id uuid NOT NULL REFERENCES moves.effect_types(id),
  power numeric NOT NULL DEFAULT 0,
  duration_turns integer,
  chance numeric NOT NULL DEFAULT 1 CHECK (chance BETWEEN 0 AND 1),
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (move_id, position)
);

CREATE TABLE moves.move_requires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id uuid NOT NULL REFERENCES moves.moves(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('weapon_type','body_part','ammo_type','stat_min','affinity')),
  value text NOT NULL,
  amount numeric
);

CREATE TABLE moves.move_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id uuid NOT NULL REFERENCES moves.moves(id) ON DELETE CASCADE,
  option_group text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('mastery','trainer','scroll','combo')),
  params jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE moves.move_stat_exp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id uuid NOT NULL REFERENCES moves.moves(id) ON DELETE CASCADE,
  stat text NOT NULL CHECK (stat IN ('str','dex','int','end','luck','charm')),
  amount numeric NOT NULL CHECK (amount > 0),
  UNIQUE (move_id, stat)
);

CREATE TABLE moves.move_interrupts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id uuid NOT NULL REFERENCES moves.moves(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('gives','broken_by')),
  tag text NOT NULL,
  UNIQUE (move_id, role, tag)
);

CREATE TABLE moves.move_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id uuid NOT NULL REFERENCES moves.moves(id) ON DELETE CASCADE,
  tag text NOT NULL,
  UNIQUE (move_id, tag)
);

CREATE TABLE moves.status_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_name text NOT NULL UNIQUE,
  effect_type_id uuid NOT NULL REFERENCES moves.effect_types(id),
  damage_type_id uuid REFERENCES moves.damage_types(id),
  element text,
  stack_rule text NOT NULL DEFAULT 'strongest' CHECK (stack_rule IN ('stack','strongest')),
  ignores_defense boolean NOT NULL DEFAULT false,
  tick_interval numeric NOT NULL DEFAULT 1,
  cure_tags text[] NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_move_effects_move ON moves.move_effects(move_id);
CREATE INDEX idx_move_requires_move ON moves.move_requires(move_id);
CREATE INDEX idx_move_unlocks_move ON moves.move_unlocks(move_id);
CREATE INDEX idx_move_stat_exp_move ON moves.move_stat_exp(move_id);