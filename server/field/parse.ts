import { MAX_HEIGHT } from './climb.ts';
import { findTownProblems } from './town.ts';
import type { Biome, FieldKind, FieldTemplate, TownLayout } from './types.ts';

// Rows from world.field_templates and world.biomes into typed values. Startup check reports bad rows.

const weights = (v: unknown): Record<string, number> =>
  Object.fromEntries(Object.entries((v ?? {}) as Record<string, unknown>).map(([k, w]) => [k, Number(w) || 0]));

export function parseTemplate(name: string, kind: string, width: number, height: number, params: Record<string, unknown>): FieldTemplate {
  return { name, kind: kind as FieldKind, width, height, obstacleMult: Number(params.obstacle_mult ?? 1), town: parseTown(params.town), travel: params.travel === 'x' || params.travel === 'y' ? params.travel : null };
}

function parseTown(raw: unknown): TownLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const buildings = Array.isArray(t.buildings) ? t.buildings as Record<string, unknown>[] : [];
  const houses = (t.houses ?? {}) as Record<string, unknown>;
  return {
    safe: Number(t.safe ?? 0), height: Number(t.height ?? 0),
    ground: String(t.ground ?? ''), road: String(t.road ?? ''), building: String(t.building ?? ''), door: String(t.door ?? ''),
    buildings: buildings.map((b) => ({ service: String(b.service ?? ''), w: Number(b.w ?? 0), h: Number(b.h ?? 0) })),
    viewReach: Number(t.view_reach ?? 0),
    houses: { max: Number(houses.max ?? 0), w: Number(houses.w ?? 2), h: Number(houses.h ?? 2) },
  };
}

export function parseBiome(name: string, params: Record<string, unknown>): Biome {
  const hills = (params.hills ?? {}) as Record<string, unknown>;
  const lowland = (params.lowland ?? {}) as Record<string, unknown>;
  return {
    name,
    ground: weights(params.ground),
    obstacles: weights(params.obstacles),
    obstacleDensity: Number(params.obstacle_density ?? 0),
    hills: { max: Number(hills.max ?? 0), scale: Number(hills.scale ?? 4), steep: Number(hills.steep ?? 1) },
    lowland: { share: Number(lowland.share ?? 0), terrain: weights(lowland.terrain) },
    nodes: weights(params.nodes),
  };
}

// Problems with templates and biomes, for the startup check.
export function findFieldProblems(templates: FieldTemplate[], biomes: Biome[]): string[] {
  const problems: string[] = [];
  for (const t of templates) {
    if (!(t.obstacleMult >= 0)) problems.push(`template ${t.name}: obstacle_mult must be 0 or more`);
    if (t.travel && t.kind !== 'corridor') problems.push(`template ${t.name}: travel is for corridors`);
    if (t.travel === 'x' && t.width < t.height) problems.push(`template ${t.name}: travel x needs width >= height`);
    if (t.travel === 'y' && t.height < t.width) problems.push(`template ${t.name}: travel y needs height >= width`);
    problems.push(...findTownProblems(t));
  }
  for (const b of biomes) {
    if (!Object.values(b.ground).some((w) => w > 0)) problems.push(`biome ${b.name}: needs at least one ground terrain`);
    if (!(b.obstacleDensity >= 0 && b.obstacleDensity <= 0.5)) problems.push(`biome ${b.name}: obstacle_density must be 0-0.5`);
    if (b.obstacleDensity > 0 && !Object.values(b.obstacles).some((w) => w > 0)) problems.push(`biome ${b.name}: has density but no obstacle terrain`);
    if (!(b.hills.max >= 0 && b.hills.max <= MAX_HEIGHT) || !(b.hills.scale >= 1)) problems.push(`biome ${b.name}: hills need max 0-${MAX_HEIGHT} and scale >= 1`);
    if (!(b.hills.steep >= 1 && b.hills.steep <= 8)) problems.push(`biome ${b.name}: hills steep must be 1-8`);
    if (!(b.lowland.share >= 0 && b.lowland.share <= 1)) problems.push(`biome ${b.name}: lowland share must be 0-1`);
    if (b.lowland.share > 0 && !Object.values(b.lowland.terrain).some((w) => w > 0)) problems.push(`biome ${b.name}: has lowland share but no lowland terrain`);
  }
  return problems;
}
