CREATE SCHEMA IF NOT EXISTS config;

CREATE TABLE config.balance_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

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