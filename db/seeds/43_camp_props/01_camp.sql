-- The camp (2026-11-08): a bedroll to sleep in and the campfire to cook at, both worked from beside them (props with a
-- `use`: the bed opens the camp's rest, the fire opens the cook's recipes at level 1, no town purse). The old rest tile goes.
UPDATE config.balance_config SET value = jsonb_set(jsonb_set(value, '{rooms,camp,props}',
  '[{"terrain": "campfire", "x": 4, "y": 3, "use": "cook"}, {"terrain": "log", "x": 2, "y": 3}, {"terrain": "log", "x": 6, "y": 3},
    {"terrain": "bed", "x": 7, "y": 5, "w": 1, "h": 2, "use": "camp"}]'::jsonb),
  '{rooms,camp,rest}', 'null'::jsonb), updated_at = now()
WHERE config_key = 'interior';
