-- Corridor shapes (2026-11-04): sizes vary, and `travel` says which way the long side runs. A border in hex direction 0
-- takes a travel-x shape (wider than tall), directions 1 and 2 a travel-y shape; the exits follow the direction
-- (server/field/exits.ts). corridor_path (8 x 20) stays for rounds made before this.
INSERT INTO world.field_templates (template_name, kind, width, height, params) VALUES
('corridor_20x12', 'corridor', 20, 12, '{"obstacle_mult":0.8,"travel":"x"}'),
('corridor_22x10', 'corridor', 22, 10, '{"obstacle_mult":0.8,"travel":"x"}'),
('corridor_18x16', 'corridor', 18, 16, '{"obstacle_mult":0.8,"travel":"x"}'),
('corridor_12x20', 'corridor', 12, 20, '{"obstacle_mult":0.8,"travel":"y"}'),
('corridor_10x22', 'corridor', 10, 22, '{"obstacle_mult":0.8,"travel":"y"}'),
('corridor_16x18', 'corridor', 16, 18, '{"obstacle_mult":0.8,"travel":"y"}')
ON CONFLICT (template_name) DO NOTHING;
