import type pg from 'pg';
import { devRoundId, fieldSpec, listFields, type FieldData } from '../data/field_repo.ts';
import { generateField } from '../field/generate.ts';
import type { FieldGrid, FieldSpec } from '../field/types.ts';
import type { LabFieldRequest } from './lab_types.ts';

// Field preview in the lab: a stored dev field, or any template + biome blend + seed. Nothing is saved.

export async function fieldCatalog(pool: pg.Pool, fields: FieldData) {
  const round = await devRoundId(pool);
  return {
    templates: [...fields.templates.values()].map((t) => ({ name: t.name, kind: t.kind, width: t.width, height: t.height })),
    biomes: [...fields.biomes.keys()],
    stored: round ? await listFields(pool, round) : [],
  };
}

const clamp01 = (v: unknown) => Math.min(1, Math.max(0, Number(v) || 0));

export async function previewField(pool: pg.Pool, fields: FieldData, req: LabFieldRequest): Promise<string | (FieldGrid & { blockedShare: number })> {
  let spec: FieldSpec | null;
  if (req.ref) {
    spec = await fieldSpec(pool, fields, String(req.ref));
    if (!spec) return `unknown field ${req.ref}`;
  } else {
    const template = fields.templates.get(String(req.template));
    const biomeA = fields.biomes.get(String(req.biomeA));
    if (!template || !biomeA) return 'pick a template and biome A';
    spec = {
      template, biomeA, biomeB: req.biomeB ? fields.biomes.get(String(req.biomeB)) ?? null : null,
      blend: { from: clamp01(req.from), to: clamp01(req.to) }, seed: Math.floor(Math.abs(Number(req.seed) || 1)) >>> 0,
    };
  }
  const grid = generateField(spec);
  return { ...grid, blockedShare: grid.tiles.filter((t) => !t.walkable).length / grid.tiles.length };
}
