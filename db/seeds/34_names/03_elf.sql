-- Name pools for elf: 50 male and 50 female first names, 100 last names (docs/WORLD.md, Names).
INSERT INTO entity.name_parts (race_name, kind, name)
SELECT 'elf', v.kind, n
FROM (VALUES
  ('first_m', ARRAY[
    'Aelar', 'Aerion', 'Belanor', 'Caelum', 'Daeron', 'Elandor', 'Faelar', 'Galadan',
    'Haldeth', 'Ilyrian', 'Jaelis', 'Kaelor', 'Lethiel', 'Maeron', 'Naelis', 'Orophin',
    'Paelias', 'Quillan', 'Rhaeldor', 'Sylvar', 'Taeril', 'Uldreth', 'Vaelor', 'Wynthar',
    'Xaelin', 'Yvandor', 'Zaeril', 'Aranel', 'Berethor', 'Cyrandil', 'Draelan', 'Eldrin',
    'Fenarel', 'Gwaelin', 'Hallavar', 'Ithilan', 'Joreth', 'Kelvaris', 'Laenor', 'Mythrel',
    'Nivelar', 'Orilan', 'Peredor', 'Raelith', 'Silvaen', 'Thalion', 'Vanduril', 'Wesaris',
    'Ylmaren', 'Elvaris'
  ]),
  ('first_f', ARRAY[
    'Aelindra', 'Anariel', 'Belaris', 'Caelynn', 'Daenara', 'Elenwe', 'Faelith', 'Galariel',
    'Haelwyn', 'Ilmara', 'Jaenith', 'Kaelira', 'Lirael', 'Maelis', 'Naevys', 'Oriel',
    'Paelyn', 'Rhiannel', 'Sylwen', 'Taeliss', 'Uriel', 'Vaeril', 'Wenyara', 'Xylia',
    'Ysolwen', 'Zaelia', 'Aeriel', 'Brethil', 'Cerelith', 'Dawnae', 'Elyndra', 'Fenwyn',
    'Gaelira', 'Hirael', 'Iolanthe', 'Jessamir', 'Kyrenna', 'Lunaris', 'Mirethil', 'Nythara',
    'Olwen', 'Phaelin', 'Rialis', 'Sariel', 'Thessaly', 'Valanya', 'Wynelle', 'Yserah',
    'Zephyrine', 'Amarisse'
  ]),
  ('last', ARRAY[
    'Moonwhisper', 'Moonsong', 'Moonglade', 'Moonshade', 'Moonbloom', 'Moondancer', 'Moonwood', 'Moonbrook',
    'Moonlight', 'Moonwalker', 'Starwhisper', 'Starsong', 'Starglade', 'Starshade', 'Starbloom', 'Stardancer',
    'Starwood', 'Starbrook', 'Starlight', 'Starwalker', 'Silverwhisper', 'Silversong', 'Silverglade', 'Silvershade',
    'Silverbloom', 'Silverdancer', 'Silverwood', 'Silverbrook', 'Silverlight', 'Silverwalker', 'Dawnwhisper', 'Dawnsong',
    'Dawnglade', 'Dawnshade', 'Dawnbloom', 'Dawndancer', 'Dawnwood', 'Dawnbrook', 'Dawnlight', 'Dawnwalker',
    'Leafwhisper', 'Leafsong', 'Leafglade', 'Leafshade', 'Leafbloom', 'Leafdancer', 'Leafwood', 'Leafbrook',
    'Leaflight', 'Leafwalker', 'Windwhisper', 'Windsong', 'Windglade', 'Windshade', 'Windbloom', 'Winddancer',
    'Windwood', 'Windbrook', 'Windlight', 'Windwalker', 'Duskwhisper', 'Dusksong', 'Duskglade', 'Duskshade',
    'Duskbloom', 'Duskdancer', 'Duskwood', 'Duskbrook', 'Dusklight', 'Duskwalker', 'Mistwhisper', 'Mistsong',
    'Mistglade', 'Mistshade', 'Mistbloom', 'Mistdancer', 'Mistwood', 'Mistbrook', 'Mistlight', 'Mistwalker',
    'Oakwhisper', 'Oaksong', 'Oakglade', 'Oakshade', 'Oakbloom', 'Oakdancer', 'Oakwood', 'Oakbrook',
    'Oaklight', 'Oakwalker', 'Riverwhisper', 'Riversong', 'Riverglade', 'Rivershade', 'Riverbloom', 'Riverdancer',
    'Riverwood', 'Riverbrook', 'Riverlight', 'Riverwalker'
  ])
) AS v(kind, names), unnest(v.names) AS n
ON CONFLICT DO NOTHING;
