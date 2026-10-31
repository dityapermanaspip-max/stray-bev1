-- MVP speakers. Missing speakers fall back to 'generic'.
INSERT INTO presentation.speakers (speaker_name, kind, portrait_set, box_style) VALUES
('generic', 'generic', '{}', 'default'),
('self', 'self', '{}', 'inner')
ON CONFLICT (speaker_name) DO NOTHING;
