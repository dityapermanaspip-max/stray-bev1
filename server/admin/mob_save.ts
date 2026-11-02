import type pg from 'pg';
import { loadBalance } from '../config/balance.ts';
import { startCounts } from '../config/world_config.ts';
import { currentRoundId } from '../data/field_repo.ts';
import { loadLoot } from '../data/loot_repo.ts';
import { loadSpecies } from '../data/species_repo.ts';
import type { MobDraft } from './mob_draft.ts';
import { checkedWrite, linked, type SaveResult } from './move_save.ts';

// Saving a creature from the admin lab: species, carcass, part items, loot tables and entries, moves, resistances,
// names, and (optional) populations in the current round, in one checked transaction (move_save.ts).
// Create makes a new species; update rewrites an existing one by species.name (same id, so living creatures,
// corpses and populations keep pointing at it): the row is updated, moves, resistances, loot entries and its name
// are replaced, listed items and the carcass are updated or added (never removed: copies may exist), and populate
// only adds rows for hexes that have none. Extra checks: every move's body parts are on the creature, and it loads.

const NAME = /^[a-z][a-z0-9_]{1,40}$/;
const STATS = ['str', 'dex', 'int', 'end', 'luck', 'charm'];

function shapeProblems(d: MobDraft): string[] {
  if (!d || typeof d !== 'object' || !d.species) return ['draft needs a "species" object'];
  const p: string[] = [];
  if (!NAME.test(String(d.species.name ?? ''))) p.push('species.name: lowercase letters, digits and _ (2-41 chars)');
  for (const s of STATS) if (!(Number(d.species.base_stats?.[s]) >= 1)) p.push(`species.base_stats.${s}: a whole number of 1 or more`);
  if (!Array.isArray(d.species.main_stats) || d.species.main_stats.length !== 2 || d.species.main_stats.some((m) => !STATS.includes(m))) {
    p.push('species.main_stats: exactly 2 core stats (they roll high in every ring)');
  }
  if (!Array.isArray(d.species.body_parts) || (d.species.body_parts.length === 0 && !d.variant_of)) p.push('species.body_parts: list at least one (a variant may leave it empty)');
  if (!Array.isArray(d.biomes ?? [])) p.push('biomes must be a list of {biome, weight}');
  if (!String(d.display_name ?? '').trim()) p.push('display_name is required');
  for (const it of d.items ?? []) {
    if (!NAME.test(String(it.name ?? ''))) p.push(`items: bad name ${it.name}`);
    if (!String(it.display ?? '').trim()) p.push(`items.${it.name}: display is required`);
  }
  if (!d.loot || !Array.isArray(d.loot.native) || !Array.isArray(d.loot.corrupted)) p.push('loot needs native and corrupted lists');
  return p;
}

async function nameLine(c: pg.PoolClient, key: string, text: string) {
  await c.query(`DELETE FROM presentation.diegetic_lines WHERE condition_key = $1`, [key]);
  await c.query(
    `INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
     SELECT $1, 0, s.id, 'neutral', $2 FROM presentation.speakers s WHERE s.speaker_name = 'generic' ON CONFLICT DO NOTHING`, [key, text.trim()],
  );
}

const UPSERT_ITEM = `INSERT INTO item.items (item_name, type, shape, data) VALUES ($1, $2, $3, $4)
  ON CONFLICT (item_name) DO UPDATE SET type = EXCLUDED.type, shape = EXCLUDED.shape, data = EXCLUDED.data`;

async function writeMob(c: pg.PoolClient, d: MobDraft, update: boolean): Promise<string[]> {
  const s = d.species;
  const old = (await c.query('SELECT id, loot_table_native, loot_table_corrupted FROM entity.species WHERE species_name = $1', [s.name])).rows[0];
  if (old && !update) return [`species ${s.name} already exists (load it to edit, or pick a new name)`];
  if (!old && update) return [`species ${s.name} does not exist (nothing to update; save it as new)`];
  const problems: string[] = [];
  for (const it of d.items ?? []) {
    if (!update && (await c.query('SELECT 1 FROM item.items WHERE item_name = $1', [it.name])).rowCount) { problems.push(`item ${it.name} already exists`); continue; }
    await c.query(UPSERT_ITEM, [it.name, it.type, it.shape, JSON.stringify(it.data ?? {})]);
    await nameLine(c, `item_name_${it.name}`, it.display);
  }
  if (d.carcass) {
    await c.query(UPSERT_ITEM, [`${s.name}_carcass`, 'carcass', 'carcass', JSON.stringify({ weight: d.carcass.weight, value: d.carcass.value, piece: true, carcass_of: s.name })]);
    await nameLine(c, `item_name_${s.name}_carcass`, `${d.display_name} carcass`);
  }
  const table = async (side: 'native' | 'corrupted') => {
    const kept: string | null = old?.[`loot_table_${side}`] ?? null;
    if (kept) await c.query('DELETE FROM item.loot_entries WHERE loot_table_id = $1', [kept]);
    const id = kept ?? (await c.query<{ id: string }>(`INSERT INTO item.loot_tables (table_name, owner) VALUES ($1, 'species') RETURNING id`, [`${s.name}_${side}`])).rows[0].id;
    const rows = d.loot[side];
    problems.push(...(await linked(c, `${side} loot item`, rows.map((r) => r.item),
      `INSERT INTO item.loot_entries (loot_table_id, item_id, chance_permille, min_qty, max_qty)
       SELECT $1, i.id, x.p, x.lo, x.hi FROM unnest($2::text[], $3::int[], $4::int[], $5::int[]) AS x(item, p, lo, hi) JOIN item.items i ON i.item_name = x.item
       RETURNING (SELECT item_name FROM item.items WHERE id = item_id) AS name`,
      [id, rows.map((r) => r.item), rows.map((r) => r.permille), rows.map((r) => r.min ?? 1), rows.map((r) => r.max ?? r.min ?? 1)])));
    return id;
  };
  const native = await table('native');
  const corrupted = await table('corrupted');
  const args = [s.name, JSON.stringify(Object.fromEntries(STATS.map((k) => [k, Math.round(Number(s.base_stats[k]))]))), s.body_parts, s.ring_min, s.ring_max,
    native, corrupted, s.on_expiry ?? 'ignore', s.main_stats];
  const cols = 'species_name, base_stats, body_parts, ring_min, ring_max, loot_table_native, loot_table_corrupted, on_expiry, main_stats';
  const speciesId = (await c.query<{ id: string }>(old
    ? `UPDATE entity.species SET (${cols}) = ROW($1, $2, $3, $4, $5, $6, $7, $8, $9) WHERE id = $10 RETURNING id`
    : `INSERT INTO entity.species (${cols}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`, old ? [...args, old.id] : args)).rows[0].id;
  if (d.variant_of) {
    const base = await c.query('UPDATE entity.species SET variant_of = (SELECT id FROM entity.species WHERE species_name = $2) WHERE id = $1 RETURNING variant_of', [speciesId, d.variant_of]);
    if (!base.rows[0]?.variant_of) problems.push(`variant_of ${d.variant_of}: not found`);
  } else if (old) await c.query('UPDATE entity.species SET variant_of = NULL WHERE id = $1', [speciesId]);
  if (old) await c.query('DELETE FROM world.biome_species WHERE species_id = $1', [speciesId]);
  const homes = d.biomes ?? [];
  problems.push(...(await linked(c, 'biome', homes.map((b) => b.biome),
    `INSERT INTO world.biome_species (biome_id, species_id, weight) SELECT b.id, $1, x.w FROM unnest($2::text[], $3::int[]) AS x(name, w)
     JOIN world.biomes b ON b.biome_name = x.name RETURNING (SELECT biome_name FROM world.biomes WHERE id = biome_id) AS name`,
    [speciesId, homes.map((b) => b.biome), homes.map((b) => Math.max(1, Math.round(Number(b.weight) || 1)))])));
  if (old) {
    await c.query('DELETE FROM entity.species_moves WHERE species_id = $1', [speciesId]);
    await c.query(`DELETE FROM entity.resistances WHERE owner_kind = 'species' AND owner_id = $1`, [speciesId]);
  }
  await nameLine(c, `species_name_${s.name}`, d.display_name);
  const dark = d.corrupted_moves ?? [];
  for (const [list, only] of [[d.moves ?? [], false], [dark, true]] as const) {
    problems.push(...(await linked(c, 'move', [...list],
      `INSERT INTO entity.species_moves (species_id, move_id, corrupted_only) SELECT $1, m.id, $3 FROM moves.moves m WHERE m.move_name = ANY($2)
       ON CONFLICT DO NOTHING RETURNING (SELECT move_name FROM moves.moves WHERE id = move_id) AS name`, [speciesId, list, only])));
  }
  for (const r of d.resistances ?? []) {
    await c.query(`INSERT INTO entity.resistances (owner_kind, owner_id, target_kind, target_id, mult) VALUES ('species', $1, $2, $3, $4)`,
      [speciesId, r.target_kind, r.target, r.mult]);
  }
  const needs = (await c.query<{ move_name: string; value: string }>(
    `SELECT m.move_name, r.value FROM moves.moves m JOIN moves.move_requires r ON r.move_id = m.id AND r.kind = 'body_part' WHERE m.move_name = ANY($1)`, [[...(d.moves ?? []), ...dark]],
  )).rows;
  for (const n of needs) if (s.body_parts.length > 0 && !s.body_parts.includes(n.value)) problems.push(`move ${n.move_name} needs body part ${n.value}, which the creature lacks`);
  if (d.populate) problems.push(...await populate(c, speciesId, s, Number(d.populate.max)));
  return problems;
}

// Every hex of the current round whose biome the creature lives in gets a population row (start counts like world
// generation; a hex that holds a town starts with no corrupted).
async function populate(c: pg.PoolClient, speciesId: string, s: MobDraft['species'], max: number): Promise<string[]> {
  if (!(max >= 1)) return ['populate.max: a whole number of 1 or more'];
  const db = c as unknown as pg.Pool;
  const [cfg, round] = await Promise.all([loadBalance(db), currentRoundId(db)]);
  const hexes = (await c.query<{ id: string; town: boolean }>(
    `SELECT h.id::text, h.field_kind = 'town' AS town FROM world.hexes h JOIN world.biomes b ON b.biome_name = h.biome
     JOIN world.biome_species bs ON bs.biome_id = b.id AND bs.species_id = $2 WHERE h.round_id = $1 AND h.ring > 0`, [round, speciesId],
  )).rows;
  if (hexes.length === 0) return ['populate: the current round has no hex in the biomes it lives in'];
  const born = (await c.query('SELECT born_corrupted FROM entity.species WHERE id = $1', [speciesId])).rows[0]?.born_corrupted === true;
  for (const h of hexes) {
    const start = startCounts(cfg.rings, max, Math.random, born);
    await c.query(
      `INSERT INTO world.field_population (field_ref, species_id, natural_count, corrupted_count, safe_count, max_count) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (field_ref, species_id) DO NOTHING`,
      [h.id, speciesId, start.natives, h.town ? 0 : start.corrupted, Math.round(max * cfg.worldGen.safeShare), Math.round(max)],
    );
  }
  return [];
}

export async function saveMob(pool: pg.Pool, draft: MobDraft, commit: boolean, update = false): Promise<SaveResult> {
  const shape = shapeProblems(draft);
  if (shape.length > 0) return { saved: false, problems: shape };
  return checkedWrite(pool, commit, (c) => writeMob(c, draft, update), async (db) => {
    const [species, loot] = await Promise.all([loadSpecies(db), loadLoot(db)]);
    return [
      ...(species.has(draft.species.name) ? [] : ['the species loader did not find the creature']),
      ...(loot.bySpecies.has(draft.species.name) ? [] : ['the loot loader did not find its tables']),
    ];
  });
}
