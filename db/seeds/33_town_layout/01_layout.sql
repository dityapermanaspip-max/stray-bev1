-- Random town layouts (2026-11-02, server/field/town.ts). Buildings stand at random spots from the field seed, doors
-- on a camera-facing side, and no building stands where it would hide a door. view_reach: rows behind a building it
-- hides on screen, per tile of w + h (the art is about as tall as it is wide). houses: door-less filler buildings.
UPDATE world.field_templates
SET params = jsonb_set(params, '{town}', params->'town' || '{"view_reach":1.1,"houses":{"max":6,"w":2,"h":2}}'::jsonb)
WHERE kind = 'town';
