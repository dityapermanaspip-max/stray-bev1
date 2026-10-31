import type pg from 'pg';
import { corridorBlend } from '../field/generate.ts';
import { parseBiome, parseTemplate } from '../field/parse.ts';
import type { Border, Hex, WorldLinks } from '../field/links.ts';
import type { Biome, FieldSpec, FieldTemplate } from '../field/types.ts';

// Field templates, biomes, and the spec of a stored field (hex or corridor). Tiles are never stored.

export type FieldData = { templates: Map<string, FieldTemplate>; biomes: Map<string, Biome> };
export type FieldRef = { ref: string; kind: 'hex' | 'corridor'; label: string };

export async function loadFieldData(pool: pg.Pool): Promise<FieldData> {
  const [templates, biomes] = await Promise.all([
    pool.query<{ template_name: string; kind: string; width: number; height: number; params: Record<string, unknown> }>(
      'SELECT template_name, kind, width, height, params FROM world.field_templates ORDER BY template_name',
    ),
    pool.query<{ biome_name: string; params: Record<string, unknown> }>('SELECT biome_name, params FROM world.biomes ORDER BY biome_name'),
  ]);
  return {
    templates: new Map(templates.rows.map((t) => [t.template_name, parseTemplate(t.template_name, t.kind, t.width, t.height, t.params)])),
    biomes: new Map(biomes.rows.map((b) => [b.biome_name, parseBiome(b.biome_name, b.params)])),
  };
}

// Every hex and corridor of a round, for pickers. field_ref is the hex or corridor id.
export async function listFields(pool: pg.Pool, roundId: string): Promise<FieldRef[]> {
  const res = await pool.query<{ ref: string; kind: 'hex' | 'corridor'; label: string }>(
    `SELECT h.id::text AS ref, 'hex' AS kind, format('hex %s,%s (%s)', h.q, h.r, h.biome) AS label, 0 AS ord
     FROM world.hexes h WHERE h.round_id = $1
     UNION ALL
     SELECT c.id::text, 'corridor', format('corridor %s,%s -> %s,%s #%s of %s', a.q, a.r, b.q, b.r, c.position, bo.corridor_count), 1
     FROM world.corridors c
     JOIN world.borders bo ON bo.id = c.border_id
     JOIN world.hexes a ON a.id = bo.hex_a
     JOIN world.hexes b ON b.id = bo.hex_b
     WHERE bo.round_id = $1
     ORDER BY 4, 3`,
    [roundId],
  );
  return res.rows.map(({ ref, kind, label }) => ({ ref, kind, label }));
}

type SpecRow = { template: string; biome_a: string | null; biome_b: string | null; seed: string; position: number | null; count: number | null };

// A hex is one biome; a corridor blends its border's two hex biomes by its position.
export async function fieldSpec(pool: pg.Pool, data: FieldData, ref: string): Promise<FieldSpec | null> {
  const res = await pool.query<SpecRow>(
    `SELECT h.field_template AS template, h.biome AS biome_a, NULL AS biome_b, h.field_seed::text AS seed, NULL::int AS position, NULL::int AS count
     FROM world.hexes h WHERE h.id::text = $1
     UNION ALL
     SELECT c.template, a.biome, b.biome, c.seed::text, c.position, bo.corridor_count
     FROM world.corridors c
     JOIN world.borders bo ON bo.id = c.border_id
     JOIN world.hexes a ON a.id = bo.hex_a
     JOIN world.hexes b ON b.id = bo.hex_b
     WHERE c.id::text = $1`,
    [ref],
  );
  const row = res.rows[0];
  if (!row) return null;
  const template = data.templates.get(row.template);
  const biomeA = data.biomes.get(row.biome_a ?? '');
  if (!template || !biomeA) return null;
  const biomeB = row.biome_b ? data.biomes.get(row.biome_b) ?? null : null;
  const blend = row.position !== null ? corridorBlend(row.position, row.count ?? 1) : { from: 0, to: 0 };
  return { template, biomeA, biomeB, blend, seed: Number(BigInt(row.seed) & 0xffffffffn) };
}

// The dev round from seeds/18_fields, until world generation exists (Step 4).
export async function devRoundId(pool: pg.Pool): Promise<string | null> {
  const res = await pool.query<{ id: string }>("SELECT id FROM world.rounds WHERE status = 'dev' ORDER BY started_at LIMIT 1");
  return res.rows[0]?.id ?? null;
}

// Hexes and borders of a round, for exit links.
export async function loadLinks(pool: pg.Pool, roundId: string): Promise<WorldLinks> {
  const [hexes, corridors] = await Promise.all([
    pool.query<{ id: string; q: number; r: number }>('SELECT id::text, q, r FROM world.hexes WHERE round_id = $1', [roundId]),
    pool.query<{ border: string; hex_a: string; hex_b: string; corridor: string | null }>(
      `SELECT bo.id::text AS border, bo.hex_a::text, bo.hex_b::text, c.id::text AS corridor
       FROM world.borders bo LEFT JOIN world.corridors c ON c.border_id = bo.id
       WHERE bo.round_id = $1 ORDER BY bo.id, c.position`,
      [roundId],
    ),
  ]);
  const hexMap = new Map<string, Hex>(hexes.rows.map((h) => [h.id, h]));
  const borders = new Map<string, Border>();
  for (const row of corridors.rows) {
    const a = hexMap.get(row.hex_a);
    const b = hexMap.get(row.hex_b);
    if (!a || !b) continue;
    const border = borders.get(row.border) ?? { a, b, corridors: [] };
    if (row.corridor) border.corridors.push(row.corridor);
    borders.set(row.border, border);
  }
  return { hexes: hexMap, borders: [...borders.values()] };
}
