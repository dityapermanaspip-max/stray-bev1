-- How vices and the boss look in battle: an actor sheet with its battle poses (the tourist and the shopkeeper are the
-- only sheets with them so far), a colour wash per type and a size. Looks only; bigger art and size later are data edits.
UPDATE config.balance_config SET value = value || '{"figures": {
  "str":   {"sheet": "characters/human/shopkeeper/shopkeeper", "tint": "#e0644f", "scale": 1.15},
  "dex":   {"sheet": "characters/human/tourist/tourist",       "tint": "#d9b13a", "scale": 1.15},
  "int":   {"sheet": "characters/human/shopkeeper/shopkeeper", "tint": "#8c6fe0", "scale": 1.15},
  "end":   {"sheet": "characters/human/tourist/tourist",       "tint": "#8a8f98", "scale": 1.15},
  "luck":  {"sheet": "characters/human/shopkeeper/shopkeeper", "tint": "#5fc47a", "scale": 1.15},
  "charm": {"sheet": "characters/human/tourist/tourist",       "tint": "#e06fb4", "scale": 1.15}
}}'::jsonb, updated_at = now()
WHERE config_key = 'vice';

UPDATE config.balance_config SET value = value || '{"figure": {"sheet": "characters/human/shopkeeper/shopkeeper", "tint": "#7a2230", "scale": 1.6}}'::jsonb, updated_at = now()
WHERE config_key = 'boss';
