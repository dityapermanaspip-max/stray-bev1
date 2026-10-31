import type { FieldGrid, FieldTemplate, Point, TownLayout } from './types.ts';

// A town hex is a normal field (same size, same wild edge) with a safe square in the middle.
// The square is flat, crossed by two roads through the centre, and lined with buildings along the
// east-west road: one band above it and one below, filled left to right, skipping the north-south road.
// A building is blocked except its door, which faces the road. Layout comes from the template (data).

export type Placed = { service: string; x: number; y: number; w: number; h: number; door: Point };
export type TownPlan = { from: Point; to: Point; road: Point; placed: Placed[]; unplaced: string[] };

const GAP = 1; // open tiles between neighbouring buildings

export function townPlan(width: number, height: number, layout: TownLayout): TownPlan {
  const from = { x: Math.floor((width - layout.safe) / 2), y: Math.floor((height - layout.safe) / 2) };
  const to = { x: from.x + layout.safe - 1, y: from.y + layout.safe - 1 };
  const road = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const spans = [[from.x, road.x - 1], [road.x + 1, to.x]];
  const bands = [{ above: true }, { above: false }];
  const slots = bands.flatMap((b) => spans.map(([start, end]) => ({ ...b, cursor: start, end })));
  const placed: Placed[] = [];
  const unplaced: string[] = [];
  for (const b of layout.buildings) {
    const slot = slots.find((s) => s.cursor + b.w - 1 <= s.end && (s.above ? road.y - b.h >= from.y : road.y + b.h <= to.y));
    if (!slot || b.w < 1 || b.h < 1) {
      unplaced.push(b.service);
      continue;
    }
    const y = slot.above ? road.y - b.h : road.y + 1;
    const door = { x: slot.cursor + Math.floor(b.w / 2), y: slot.above ? road.y - 1 : road.y + 1 };
    placed.push({ service: b.service, x: slot.cursor, y, w: b.w, h: b.h, door });
    slot.cursor += b.w + GAP;
  }
  return { from, to, road, placed, unplaced };
}

// Lays the town over a generated field. Runs before slopes and connecting, so the wild edge still meets it.
export function applyTown(g: FieldGrid, layout: TownLayout): void {
  const plan = townPlan(g.width, g.height, layout);
  // The wild edge rises at most one level per tile away from the square, so the town always meets it by steps.
  g.tiles.forEach((t, i) => {
    const x = i % g.width;
    const y = Math.floor(i / g.width);
    const away = Math.max(plan.from.x - x, x - plan.to.x, plan.from.y - y, y - plan.to.y);
    if (away > 0) t.height = Math.min(t.height, layout.height + away);
  });
  for (let y = plan.from.y; y <= plan.to.y; y++) {
    for (let x = plan.from.x; x <= plan.to.x; x++) {
      const t = g.tiles[y * g.width + x];
      const onRoad = x === plan.road.x || y === plan.road.y;
      Object.assign(t, { terrain: onRoad ? layout.road : layout.ground, height: layout.height, walkable: true, slope: null, safe: true, service: null });
    }
  }
  for (const b of plan.placed) {
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        const t = g.tiles[y * g.width + x];
        const door = x === b.door.x && y === b.door.y;
        Object.assign(t, { terrain: door ? layout.door : layout.building, walkable: door, service: door ? b.service : null });
      }
    }
  }
  g.spawn = { ...plan.road };
}

export const isSafe = (g: FieldGrid, p: Point) => !!g.tiles[p.y * g.width + p.x]?.safe;

// Problems with a town layout, for the startup check.
export function findTownProblems(t: FieldTemplate): string[] {
  const town = t.town;
  if (t.kind !== 'town') return town ? [`template ${t.name}: only town templates have a town layout`] : [];
  if (!town) return [`template ${t.name}: a town template needs a town layout`];
  const problems: string[] = [];
  if (!(town.safe >= 6 && town.safe <= Math.min(t.width, t.height) - 2)) problems.push(`template ${t.name}: town safe must be 6 to size - 2`);
  if (!(town.height >= 0 && town.height <= 3)) problems.push(`template ${t.name}: town height must be 0-3`);
  for (const k of ['ground', 'road', 'building', 'door'] as const) if (!town[k]) problems.push(`template ${t.name}: town ${k} terrain missing`);
  if (problems.length > 0) return problems;
  const plan = townPlan(t.width, t.height, town);
  if (plan.unplaced.length > 0) problems.push(`template ${t.name}: no room for ${plan.unplaced.join(', ')}`);
  const services = town.buildings.map((b) => b.service);
  if (services.some((s) => !s) || new Set(services).size !== services.length) problems.push(`template ${t.name}: each building needs its own service`);
  return problems;
}
