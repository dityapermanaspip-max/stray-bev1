CREATE SCHEMA IF NOT EXISTS account;

CREATE TABLE account.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  crystal_uses integer NOT NULL DEFAULT 0 CHECK (crystal_uses >= 0)
);

CREATE TABLE account.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account.accounts(id),
  type text NOT NULL CHECK (type IN ('demon_slayer','tournament_champion')),
  round_id uuid NOT NULL, -- FK to world.rounds added in 011
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, type, round_id)
);