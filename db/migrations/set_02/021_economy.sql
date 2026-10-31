-- Town economy (Step 3b). Each town has a shop purse, a ceiling on what its villagers will pay for one thing,
-- specialty goods, and a stock count per item and quality. Prices are never stored: they follow stock.
CREATE TABLE world.town_economy (
  town_ref text PRIMARY KEY, -- hex id as text
  purse integer NOT NULL CHECK (purse >= 0), -- copper the shop can spend
  max_buy integer NOT NULL CHECK (max_buy >= 0), -- the shop never pays more than this for one item
  specialties text[] NOT NULL DEFAULT '{}' -- item goods families made here (wood, chicken, ...)
);

CREATE TABLE world.town_stock (
  town_ref text NOT NULL REFERENCES world.town_economy(town_ref) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES item.items(id),
  quality text NOT NULL DEFAULT 'common',
  qty integer NOT NULL CHECK (qty >= 0),
  PRIMARY KEY (town_ref, item_id, quality)
);

-- What craftsmen make. inputs: [{item, qty}]. The fee comes from config (share of the value added).
CREATE TABLE item.crafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  craft_name text NOT NULL UNIQUE,
  craftsman text NOT NULL, -- the town service that makes it (cook, woodworker, ...)
  output_item_id uuid NOT NULL REFERENCES item.items(id),
  output_qty integer NOT NULL DEFAULT 1 CHECK (output_qty > 0),
  inputs jsonb NOT NULL
);
