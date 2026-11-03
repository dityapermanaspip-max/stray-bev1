-- Name pools for dwarf: 50 male and 50 female first names, 100 last names (docs/WORLD.md, Names).
INSERT INTO entity.name_parts (race_name, kind, name)
SELECT 'dwarf', v.kind, n
FROM (VALUES
  ('first_m', ARRAY[
    'Balin', 'Borin', 'Brokk', 'Dain', 'Dorin', 'Durgan', 'Eitri', 'Farin',
    'Gimrik', 'Gloin', 'Grundar', 'Harbek', 'Hargun', 'Ivar', 'Jorund', 'Kazrik',
    'Korgan', 'Magni', 'Morgrim', 'Nori', 'Orsik', 'Rurik', 'Skarn', 'Storgrim',
    'Thorek', 'Thrain', 'Torvald', 'Ulfgar', 'Vondal', 'Yngvar', 'Bofur', 'Bruni',
    'Dolgrim', 'Drogan', 'Fundin', 'Gandrik', 'Haldor', 'Hjalmar', 'Kildrin', 'Lodur',
    'Muradin', 'Nalgrim', 'Oin', 'Rangrim', 'Sigurd', 'Tordek', 'Umbar', 'Varnok',
    'Wolgrim', 'Bardin'
  ]),
  ('first_f', ARRAY[
    'Astrid', 'Bera', 'Brynja', 'Dagny', 'Disa', 'Eira', 'Freydis', 'Gerda',
    'Gunnhild', 'Hilda', 'Ingrith', 'Jorun', 'Kelda', 'Liv', 'Magna', 'Nala',
    'Olga', 'Ragna', 'Runa', 'Sigrun', 'Thora', 'Ulla', 'Vigdis', 'Yrsa',
    'Alvilda', 'Birna', 'Borghild', 'Dalla', 'Embla', 'Fjola', 'Grima', 'Helga',
    'Idun', 'Jarla', 'Katla', 'Lofn', 'Mjoll', 'Nanna', 'Odda', 'Rinda',
    'Saga', 'Tove', 'Unn', 'Valka', 'Wilda', 'Bodil', 'Draupa', 'Eyja',
    'Hallgerd', 'Svala'
  ]),
  ('last', ARRAY[
    'Ironfist', 'Ironbeard', 'Irondelver', 'Ironbrow', 'Ironhand', 'Ironvein', 'Ironfall', 'Ironbreaker',
    'Ironforge', 'Ironheart', 'Stonefist', 'Stonebeard', 'Stonedelver', 'Stonebrow', 'Stonehand', 'Stonevein',
    'Stonefall', 'Stonebreaker', 'Stoneforge', 'Stoneheart', 'Deepfist', 'Deepbeard', 'Deepdelver', 'Deepbrow',
    'Deephand', 'Deepvein', 'Deepfall', 'Deepbreaker', 'Deepforge', 'Deepheart', 'Anvilfist', 'Anvilbeard',
    'Anvildelver', 'Anvilbrow', 'Anvilhand', 'Anvilvein', 'Anvilfall', 'Anvilbreaker', 'Anvilforge', 'Anvilheart',
    'Coalfist', 'Coalbeard', 'Coaldelver', 'Coalbrow', 'Coalhand', 'Coalvein', 'Coalfall', 'Coalbreaker',
    'Coalforge', 'Coalheart', 'Goldfist', 'Goldbeard', 'Golddelver', 'Goldbrow', 'Goldhand', 'Goldvein',
    'Goldfall', 'Goldbreaker', 'Goldforge', 'Goldheart', 'Hammerfist', 'Hammerbeard', 'Hammerdelver', 'Hammerbrow',
    'Hammerhand', 'Hammervein', 'Hammerfall', 'Hammerbreaker', 'Hammerforge', 'Hammerheart', 'Rockfist', 'Rockbeard',
    'Rockdelver', 'Rockbrow', 'Rockhand', 'Rockvein', 'Rockfall', 'Rockbreaker', 'Rockforge', 'Rockheart',
    'Steelfist', 'Steelbeard', 'Steeldelver', 'Steelbrow', 'Steelhand', 'Steelvein', 'Steelfall', 'Steelbreaker',
    'Steelforge', 'Steelheart', 'Emberfist', 'Emberbeard', 'Emberdelver', 'Emberbrow', 'Emberhand', 'Embervein',
    'Emberfall', 'Emberbreaker', 'Emberforge', 'Emberheart'
  ])
) AS v(kind, names), unnest(v.names) AS n
ON CONFLICT DO NOTHING;
