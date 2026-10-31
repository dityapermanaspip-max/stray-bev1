CREATE SCHEMA IF NOT EXISTS presentation;

CREATE TABLE presentation.portraits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portrait_name text NOT NULL UNIQUE,
  expression_set jsonb NOT NULL DEFAULT '[]'::jsonb,
  palette jsonb NOT NULL DEFAULT '{}'::jsonb,
  sprite_base_id text,
  custom_sprite_sheet text
);

CREATE TABLE presentation.speakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  speaker_name text NOT NULL UNIQUE, -- readable key, display text comes from lines
  kind text NOT NULL CHECK (kind IN ('generic','self','narrator','npc','vice','boss','creature')),
  portrait_set jsonb NOT NULL DEFAULT '{}'::jsonb,
  box_style text NOT NULL DEFAULT 'default'
);

-- One sentence per row. Pick order: speaker override, personality_tag match, generic.
CREATE TABLE presentation.diegetic_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_key text NOT NULL,
  tier integer NOT NULL DEFAULT 0,
  speaker_id uuid NOT NULL REFERENCES presentation.speakers(id),
  personality_tag text,
  expression text NOT NULL DEFAULT 'neutral',
  text text NOT NULL CHECK (length(text) > 0),
  locale text NOT NULL DEFAULT 'en',
  UNIQUE NULLS NOT DISTINCT (condition_key, tier, speaker_id, personality_tag, locale, text)
);

CREATE INDEX idx_lines_lookup ON presentation.diegetic_lines(condition_key, tier, locale);
