import type pg from 'pg';

// A creature (species) as one editable JSON draft (admin lab): the species row and what points at it.
//   Definition: species_moves (moves by name), resistances (owner_kind species), the native and corrupted loot
//   tables (<name>_native, <name>_corrupted) with their entries, the carcass item (carcass_of), and new part items
//   its loot needs. Lines: species_name_<name> and item_name_<item> (exactly one each).
//   Where it lives: biomes (world.biome_species, weight per biome); variant_of (the species it is a variant of:
//   an empty move pool, main stats or body parts come from there).
//   Optional: populate (field_population rows in every hex of the current round whose biome it lives in).
//   corpses and creature entities are made by play, never here.

export type MobItem = { name: string; type: string; shape: string; display: string; data: Record<string, unknown> };
export type LootLine = { item: string; permille: number; min: number; max: number };

export type MobDraft = {
  species: {
    name: string; base_stats: Record<string, number>; main_stats: string[]; body_parts: string[]; ring_min: number; ring_max: number; on_expiry: 'devour' | 'ignore';
  };
  display_name: string;
  variant_of: string | null;
  biomes: { biome: string; weight: number }[];
  moves: string[];
  corrupted_moves?: string[]; // only a corrupted one rolls these
  resistances: { target_kind: 'damage_type' | 'element' | 'status'; target: string; mult: number }[];
  carcass: { weight: number; value: number } | null;
  items: MobItem[];
  loot: { native: LootLine[]; corrupted: LootLine[] };
  populate: { max: number } | null;
};

export function blankMob(): MobDraft {
  return {
    species: { name: 'new_mob', base_stats: { str: 3, dex: 3, int: 1, end: 3, luck: 3, charm: 2 }, main_stats: ['str', 'end'], body_parts: ['teeth', 'feet', 'body'], ring_min: 4, ring_max: 4, on_expiry: 'ignore' },
    display_name: 'New Mob',
    variant_of: null,
    biomes: [{ biome: 'meadow', weight: 1 }],
    moves: ['bite'],
    corrupted_moves: [],
    resistances: [],
    carcass: { weight: 4, value: 8 },
    items: [{ name: 'new_mob_meat', type: 'food', shape: 'meat', display: 'New mob meat', data: { weight: 0.6, value: 3, edible: true, rots_to: 'rotten_meat' } }],
    loot: {
      native: [{ item: 'new_mob_meat', permille: 800, min: 1, max: 2 }, { item: 'bone', permille: 400, min: 1, max: 2 }],
      corrupted: [{ item: 'tainted_meat', permille: 800, min: 1, max: 2 }, { item: 'essence', permille: 700, min: 1, max: 1 }],
    },
    populate: null,
  };
}

// An existing species as a draft (a starting point, or an example for the AI). Its items already exist, so
// `items` stays empty; the carcass is listed with its weight and value. Null when unknown.
export async function exportMob(pool: pg.Pool, name: string): Promise<MobDraft | null> {
  const s = (await pool.query('SELECT * FROM entity.species WHERE species_name = $1', [name])).rows[0];
  if (!s) return null;
  const [moves, resist, carcass, label, loot, biomes, base] = await Promise.all([
    pool.query('SELECT m.move_name, sm.corrupted_only FROM entity.species_moves sm JOIN moves.moves m ON m.id = sm.move_id WHERE sm.species_id = $1 ORDER BY 1', [s.id]),
    pool.query(`SELECT target_kind, target_id, mult FROM entity.resistances WHERE owner_kind = 'species' AND owner_id = $1 ORDER BY 1, 2`, [s.id]),
    pool.query(`SELECT data FROM item.items WHERE data->>'carcass_of' = $1 LIMIT 1`, [name]),
    pool.query(`SELECT text FROM presentation.diegetic_lines WHERE condition_key = $1 LIMIT 1`, [`species_name_${name}`]),
    pool.query(
      `SELECT (t.id = $2) AS corrupted, i.item_name, e.chance_permille, e.min_qty, e.max_qty FROM item.loot_tables t
       JOIN item.loot_entries e ON e.loot_table_id = t.id JOIN item.items i ON i.id = e.item_id WHERE t.id IN ($1, $2) ORDER BY i.item_name`,
      [s.loot_table_native, s.loot_table_corrupted],
    ),
    pool.query('SELECT b.biome_name, bs.weight FROM world.biome_species bs JOIN world.biomes b ON b.id = bs.biome_id WHERE bs.species_id = $1 ORDER BY 1', [s.id]),
    pool.query('SELECT species_name FROM entity.species WHERE id = $1', [s.variant_of]),
  ]);
  const lootOf = (corrupted: boolean) => loot.rows.filter((r) => r.corrupted === corrupted)
    .map((r) => ({ item: r.item_name, permille: r.chance_permille, min: r.min_qty, max: r.max_qty }));
  const c = carcass.rows[0]?.data;
  return {
    species: { name, base_stats: s.base_stats, main_stats: s.main_stats ?? [], body_parts: s.body_parts, ring_min: s.ring_min, ring_max: s.ring_max, on_expiry: s.on_expiry },
    display_name: label.rows[0]?.text ?? name,
    variant_of: base.rows[0]?.species_name ?? null,
    biomes: biomes.rows.map((b) => ({ biome: b.biome_name, weight: b.weight })),
    moves: moves.rows.filter((m) => !m.corrupted_only).map((m) => m.move_name),
    corrupted_moves: moves.rows.filter((m) => m.corrupted_only).map((m) => m.move_name),
    resistances: resist.rows.map((r) => ({ target_kind: r.target_kind, target: r.target_id, mult: Number(r.mult) })),
    carcass: c ? { weight: Number(c.weight), value: Number(c.value) } : null,
    items: [],
    loot: { native: lootOf(false), corrupted: lootOf(true) },
    populate: null,
  };
}

// Names the editor and the AI may use, plus the ring ladder (total core stats per ring).
export type MobReference = {
  species: string[]; moves: { name: string; needs: string[] }[]; items: string[]; itemTypes: string[]; damageTypes: string[];
  statuses: string[]; bodyParts: string[]; rings: unknown; gen: unknown; biomes: string[];
};

export async function mobReference(pool: pg.Pool): Promise<MobReference> {
  const col = async (sql: string) => (await pool.query(sql)).rows.map((r) => r.v);
  const [species, moves, items, itemTypes, damageTypes, statuses, bodyParts, rings, gen, biomes] = await Promise.all([
    col('SELECT species_name AS v FROM entity.species ORDER BY 1'),
    pool.query(`SELECT m.move_name, coalesce(array_agg(r.value) FILTER (WHERE r.kind = 'body_part'), '{}') AS needs
                FROM moves.moves m LEFT JOIN moves.move_requires r ON r.move_id = m.id WHERE m.category <> 'life' GROUP BY 1 ORDER BY 1`).then((r) => r.rows),
    col(`SELECT item_name AS v FROM item.items WHERE type IN ('food','part','material','essence') ORDER BY 1`),
    col('SELECT DISTINCT type AS v FROM item.items ORDER BY 1'),
    col('SELECT damage_type_name AS v FROM moves.damage_types ORDER BY 1'),
    col('SELECT status_name AS v FROM moves.status_types ORDER BY 1'),
    col(`SELECT DISTINCT unnest(body_parts) AS v FROM entity.species ORDER BY 1`),
    pool.query(`SELECT value FROM config.balance_config WHERE config_key = 'world.rings'`).then((r) => r.rows[0]?.value ?? null),
    pool.query(`SELECT value FROM config.balance_config WHERE config_key = 'creature.gen'`).then((r) => r.rows[0]?.value ?? null),
    col('SELECT biome_name AS v FROM world.biomes ORDER BY 1'),
  ]);
  return { species, moves: moves.map((m) => ({ name: m.move_name, needs: m.needs })), items, itemTypes, damageTypes, statuses, bodyParts, rings, gen, biomes };
}
