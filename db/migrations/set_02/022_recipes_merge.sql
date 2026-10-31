-- One recipe table (Step 3c). item.crafts (Step 3b) merges into item.recipes: a town craftsman is a facility
-- (facility_type = the town service: cook, woodworker, tanner, ...). inputs and outputs: [{item, qty}] by item name.
-- recipe_requires (life skills) applies when a player crafts it themselves, later.
INSERT INTO item.recipes (recipe_name, facility_type, min_facility_level, inputs, outputs)
SELECT c.craft_name, c.craftsman, 1, c.inputs, jsonb_build_array(jsonb_build_object('item', i.item_name, 'qty', c.output_qty))
FROM item.crafts c JOIN item.items i ON i.id = c.output_item_id
ON CONFLICT (recipe_name) DO NOTHING;

DROP TABLE item.crafts;

ALTER TABLE item.recipes ALTER COLUMN inputs SET DEFAULT '[]'::jsonb, ALTER COLUMN outputs SET DEFAULT '[]'::jsonb;

-- Each town's craftsman levels: service -> level (missing = 1). A recipe needs min_facility_level or better.
ALTER TABLE world.town_economy ADD COLUMN facilities jsonb NOT NULL DEFAULT '{}'::jsonb;
