-- Name pools for human: 50 male and 50 female first names, 100 last names (docs/WORLD.md, Names).
INSERT INTO entity.name_parts (race_name, kind, name)
SELECT 'human', v.kind, n
FROM (VALUES
  ('first_m', ARRAY[
    'Aldric', 'Bram', 'Cedric', 'Dorian', 'Edmund', 'Falk', 'Gareth', 'Hugh',
    'Ivan', 'Jasper', 'Kellan', 'Lucan', 'Marek', 'Nolan', 'Osric', 'Piers',
    'Quentin', 'Roderick', 'Silas', 'Tobias', 'Ulric', 'Victor', 'Walter', 'Xavier',
    'Yorick', 'Zane', 'Alaric', 'Benedict', 'Conrad', 'Dunstan', 'Emeric', 'Fergus',
    'Godwin', 'Harlan', 'Ivo', 'Joren', 'Kendrick', 'Leofric', 'Matthias', 'Nigel',
    'Orrin', 'Percival', 'Rowan', 'Soren', 'Tristan', 'Ambrose', 'Baldric', 'Cormac',
    'Darius', 'Eamon'
  ]),
  ('first_f', ARRAY[
    'Adela', 'Brenna', 'Cora', 'Dara', 'Elspeth', 'Fenna', 'Greta', 'Hesta',
    'Isolde', 'Jora', 'Kira', 'Lirra', 'Maren', 'Nessa', 'Odette', 'Pella',
    'Rhosyn', 'Sabine', 'Tamsin', 'Una', 'Vela', 'Wynne', 'Yara', 'Zelda',
    'Alys', 'Beatrix', 'Clara', 'Dorothea', 'Eleanor', 'Freya', 'Gwen', 'Helena',
    'Ingrid', 'Joan', 'Katrin', 'Lena', 'Mirabel', 'Nora', 'Opal', 'Petra',
    'Quilla', 'Rosalind', 'Sibyl', 'Thea', 'Ursa', 'Violet', 'Willa', 'Agnes',
    'Bryn', 'Cecily'
  ]),
  ('last', ARRAY[
    'Ashford', 'Blackwood', 'Brewer', 'Carter', 'Cooper', 'Dale', 'Fletcher', 'Fisher',
    'Gray', 'Hale', 'Harper', 'Hollis', 'Marsh', 'Miller', 'Mason', 'Penn',
    'Porter', 'Reeve', 'Sawyer', 'Shepherd', 'Smith', 'Tanner', 'Thatcher', 'Turner',
    'Wainwright', 'Weaver', 'Wright', 'Yates', 'Archer', 'Baker', 'Bishop', 'Brook',
    'Burke', 'Chandler', 'Clark', 'Cole', 'Crane', 'Dyer', 'Elms', 'Field',
    'Finch', 'Forge', 'Frost', 'Garrow', 'Glover', 'Grove', 'Hart', 'Hawke',
    'Heath', 'Holt', 'Hunter', 'Kemp', 'Lark', 'Lowe', 'Marlow', 'Merrick',
    'Moor', 'Naylor', 'Oakes', 'Page', 'Palmer', 'Pike', 'Quarry', 'Rook',
    'Rudd', 'Sheldon', 'Slade', 'Stone', 'Swift', 'Thorne', 'Tilden', 'Vane',
    'Walsh', 'Ward', 'Warren', 'Wells', 'Whitlock', 'Wolfe', 'Wynter', 'Abbot',
    'Barlow', 'Bell', 'Birch', 'Calder', 'Dunmore', 'Everett', 'Fenwick', 'Gale',
    'Harrow', 'Ingram', 'Jarrow', 'Knoll', 'Lambert', 'Mercer', 'Norwood', 'Ormond',
    'Pryor', 'Radley', 'Selby', 'Talbot'
  ])
) AS v(kind, names), unnest(v.names) AS n
ON CONFLICT DO NOTHING;
