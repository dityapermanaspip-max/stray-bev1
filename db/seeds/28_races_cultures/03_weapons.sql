-- Weapons for the new trees (docs/MOVE_TREES.md). The gathering tools can be swung too; each weapon teaches its
-- tier 1 starter on the first equip. Tonfa are a pair held as one item in both hands (needs_dual: only a dual
-- wielder takes them up). The shield sits in the off hand beside any one-handed weapon and teaches both its moves.
-- Arrows are ammo: every stack in the bag counts in battle. Numbers are first guesses, tune later.
UPDATE item.items SET data = data || x.extra::jsonb
FROM (VALUES
  ('hatchet',     '{"wield":{"weapon_type":"axe","power":5,"accuracy":0.95,"hands":1,"grants_move":"axe_chop"}}'),
  ('pickaxe',     '{"wield":{"weapon_type":"pick","power":7,"accuracy":0.9,"hands":2,"vs_armor":{"metal":0.15},"grants_move":"pick_swing"}}'),
  ('fishing_rod', '{"wield":{"weapon_type":"rod","power":2,"hands":2,"grants_move":"rod_whip"}}')
) AS x(item_name, extra)
WHERE item.items.item_name = x.item_name AND NOT (item.items.data ? 'wield');

INSERT INTO item.items (item_name, type, shape, core_material_id, data)
SELECT x.item_name, x.type, x.shape, m.id, x.data::jsonb
FROM (VALUES
  ('iron_war_axe',    'weapon',   'war_axe',    'iron',
   '{"weight":5,"value":140,"wield":{"weapon_type":"axe","power":9,"accuracy":0.9,"hands":2,"grants_move":"axe_chop"}}'),
  ('oak_bow',         'weapon',   'bow',        'oak',
   '{"weight":1,"value":60,"wield":{"weapon_type":"bow","power":6,"hands":2,"grants_move":"shot"}}'),
  ('oak_arrow',       'material', 'arrow',      'oak',
   '{"weight":0.05,"value":1,"stack":true,"ammo_type":"arrow"}'),
  ('oak_tonfa',       'weapon',   'tonfa',      'oak',
   '{"weight":2,"value":50,"wield":{"weapon_type":"tonfa","power":4,"hands":2,"needs_dual":true,"grants_move":"tonfa_strike"}}'),
  ('iron_spear',      'weapon',   'spear',      'iron',
   '{"weight":3,"value":90,"wield":{"weapon_type":"spear","power":7,"hands":2,"grants_move":"spear_thrust"}}'),
  ('iron_greatsword', 'weapon',   'greatsword', 'iron',
   '{"weight":7,"value":220,"wield":{"weapon_type":"great_sword","power":11,"accuracy":0.9,"hands":2,"grants_move":"greatsword_sweep"}}'),
  ('steel_katana',    'weapon',   'katana',     'steel',
   '{"weight":2.5,"value":200,"wield":{"weapon_type":"katana","power":8,"accuracy":1.05,"hands":1,"grants_move":"iai_cut"}}'),
  ('iron_mace',       'weapon',   'mace',       'iron',
   '{"weight":4,"value":100,"wield":{"weapon_type":"mace","power":7,"hands":1,"vs_armor":{"metal":0.1},"grants_move":"mace_bash"}}'),
  ('oak_shield',      'weapon',   'shield',     'oak',
   '{"weight":4,"value":45,"wield":{"weapon_type":"shield","power":2,"hands":1,"off_hand_only":true,"grants_move":"shield_block","off_grants_move":"shield_bash"}}')
) AS x(item_name, type, shape, material_name, data)
JOIN item.materials m ON m.material_name = x.material_name
ON CONFLICT (item_name) DO NOTHING;

INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
SELECT 'item_name_' || x.item_name, 0, s.id, 'neutral', x.text
FROM (VALUES
  ('iron_war_axe','Iron war axe'), ('oak_bow','Oak bow'), ('oak_arrow','Oak arrow'), ('oak_tonfa','Oak tonfa'),
  ('iron_spear','Iron spear'), ('iron_greatsword','Iron greatsword'), ('steel_katana','Steel katana'),
  ('iron_mace','Iron mace'), ('oak_shield','Oak shield')
) AS x(item_name, text)
JOIN presentation.speakers s ON s.speaker_name = 'generic'
ON CONFLICT DO NOTHING;

-- The spear reaches both enemy rows from either row; from behind a living front row it may strike the ally in front.
UPDATE moves.moves SET row_rule = 'reach' WHERE move_name = 'spear_thrust';
INSERT INTO config.balance_config (config_key, value, description) VALUES
('combat.reach_stray_chance', '0.25', 'A reach move (spear) used from behind a living front row strikes an ally in front instead, this often (per target).')
ON CONFLICT (config_key) DO NOTHING;

-- Arrows a recruit carries per ammo item in its template gear.
UPDATE config.balance_config SET value = value || '{"ammo_carried": 20}'::jsonb WHERE config_key = 'recruit';
