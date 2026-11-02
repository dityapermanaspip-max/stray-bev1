import { createRng, type Rng } from '../util/rng.ts';
import { layerSeed } from './noise.ts';
import type { FieldGrid, FieldTemplate, Point, TownLayout } from './types.ts';

// A town hex is a normal field (same size, same wild edge) with a safe square in the middle: flat, crossed by two
// roads through the centre. Buildings stand at random spots (from the field seed) off the roads, one tile apart.
// Every door is on a side facing the camera (+x or +y) with open ground in front, and no building stands where it
// would hide a door: a building covers the tiles behind it on screen up to `view_reach` x (w + h) rows above its
// back corner, across its own screen columns. Every open tile of the square stays reachable. Door-less houses fill
// the rest (up to `houses.max`), skipped wherever they would hide a door. Each service gets its building; when one
// does not fit, the whole plan is drawn again from the next seed.

export type Placed = { service: string | null; x: number; y: number; w: number; h: number; door: Point | null };
export type TownPlan = { from: Point; to: Point; road: Point; placed: Placed[]; unplaced: string[] };

const GAP = 1; // open tiles between neighbouring buildings
const TOWN_LAYER = 8;
const TRIES = 300; // random spots tried per building
const PLANS = 20; // whole plans tried before giving up on a service

function inside(p: Point, from: Point, to: Point): boolean {
  return p.x >= from.x && p.y >= from.y && p.x <= to.x && p.y <= to.y;
}

// True when building b hides the tile p (a door) from the camera.
function hides(b: Placed, p: Point, reach: number): boolean {
  const sx = p.x - p.y, row = p.x + p.y;
  if (sx < b.x - (b.y + b.h - 1) || sx > b.x + b.w - 1 - b.y) return false;
  const back = b.x + b.y, front = b.x + b.w - 1 + b.y + b.h - 1;
  return row < front && row >= back - Math.ceil(reach * (b.w + b.h));
}

// Open square tiles all join the road centre (buildings block, doors are walkable).
function connected(plan: TownPlan, blocked: (p: Point) => boolean): boolean {
  const key = (p: Point) => `${p.x},${p.y}`;
  const seen = new Set([key(plan.road)]);
  const queue = [plan.road];
  while (queue.length) {
    const p = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (!inside(n, plan.from, plan.to) || seen.has(key(n)) || blocked(n)) continue;
      seen.add(key(n));
      queue.push(n);
    }
  }
  let open = 0;
  for (let y = plan.from.y; y <= plan.to.y; y++) for (let x = plan.from.x; x <= plan.to.x; x++) if (!blocked({ x, y })) open++;
  return seen.size === open;
}

// One building at a random spot, or null after TRIES. Houses (service null) get no door.
function placeOne(rng: Rng, plan: TownPlan, size: { w: number; h: number }, service: string | null, reach: number): Placed | null {
  const at = (b: Placed, p: Point) => p.x >= b.x && p.y >= b.y && p.x < b.x + b.w && p.y < b.y + b.h;
  const near = (b: Placed, p: Point) => p.x >= b.x - GAP && p.y >= b.y - GAP && p.x < b.x + b.w + GAP && p.y < b.y + b.h + GAP;
  const onRoad = (p: Point) => p.x === plan.road.x || p.y === plan.road.y;
  const doors = plan.placed.flatMap((b) => (b.door ? [b.door] : []));
  for (let i = 0; i < TRIES; i++) {
    const turn = rng() < 0.5;
    const w = turn ? size.h : size.w, h = turn ? size.w : size.h;
    const b: Placed = {
      service, w, h, door: null,
      x: plan.from.x + Math.floor(rng() * (plan.to.x - plan.from.x + 2 - w)),
      y: plan.from.y + Math.floor(rng() * (plan.to.y - plan.from.y + 2 - h)),
    };
    const tiles = Array.from({ length: w * h }, (_, k) => ({ x: b.x + (k % w), y: b.y + Math.floor(k / w) }));
    if (tiles.some((p) => !inside(p, plan.from, plan.to) || onRoad(p) || plan.placed.some((o) => near(o, p)))) continue;
    if (service) {
      const side = rng() < 0.5 ? 'x' : 'y', len = side === 'x' ? h : w;
      const k = len >= 3 ? 1 + Math.floor(rng() * (len - 2)) : Math.floor(rng() * len); // not on a corner
      b.door = side === 'x' ? { x: b.x + w - 1, y: b.y + k } : { x: b.x + k, y: b.y + h - 1 };
      const front = side === 'x' ? { x: b.door.x + 1, y: b.door.y } : { x: b.door.x, y: b.door.y + 1 };
      if (!inside(front, plan.from, plan.to) || plan.placed.some((o) => near(o, front) && at(o, front))) continue;
      if (plan.placed.some((o) => hides(o, b.door!, reach))) continue;
    }
    if (doors.some((d) => hides(b, d, reach))) continue;
    const all = [...plan.placed, b];
    if (!connected(plan, (p) => all.some((o) => at(o, p) && !(o.door && o.door.x === p.x && o.door.y === p.y)))) continue;
    return b;
  }
  return null;
}

export function townPlan(width: number, height: number, layout: TownLayout, seed = 1): TownPlan {
  const from = { x: Math.floor((width - layout.safe) / 2), y: Math.floor((height - layout.safe) / 2) };
  const to = { x: from.x + layout.safe - 1, y: from.y + layout.safe - 1 };
  const road = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  let plan: TownPlan = { from, to, road, placed: [], unplaced: [] };
  for (let attempt = 0; attempt < PLANS; attempt++) {
    const rng = createRng(layerSeed(seed + attempt, TOWN_LAYER));
    plan = { from, to, road, placed: [], unplaced: [] };
    for (const b of layout.buildings) {
      const placed = b.w >= 1 && b.h >= 1 ? placeOne(rng, plan, b, b.service, layout.viewReach) : null;
      if (placed) plan.placed.push(placed);
      else plan.unplaced.push(b.service);
    }
    if (plan.unplaced.length === 0) break;
  }
  for (let i = 0; i < layout.houses.max; i++) {
    const house = placeOne(createRng(layerSeed(seed + i, TOWN_LAYER + 1)), plan, layout.houses, null, layout.viewReach);
    if (house) plan.placed.push(house);
  }
  return plan;
}

// Lays the town over a generated field. Runs before connecting, so the wild edge still meets it.
export function applyTown(g: FieldGrid, layout: TownLayout, seed = 1): void {
  const plan = townPlan(g.width, g.height, layout, seed);
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
        const door = !!b.door && x === b.door.x && y === b.door.y;
        Object.assign(t, { terrain: door ? layout.door : layout.building, walkable: door, service: door ? b.service : null });
      }
    }
  }
  g.spawn = { ...plan.road };
}

export const isSafe = (g: FieldGrid, p: Point) => !!g.tiles[p.y * g.width + p.x]?.safe;

// Problems with a town layout, for the startup check. Every service must find room over a range of seeds.
export function findTownProblems(t: FieldTemplate): string[] {
  const town = t.town;
  if (t.kind !== 'town') return town ? [`template ${t.name}: only town templates have a town layout`] : [];
  if (!town) return [`template ${t.name}: a town template needs a town layout`];
  const problems: string[] = [];
  if (!(town.safe >= 6 && town.safe <= Math.min(t.width, t.height) - 2)) problems.push(`template ${t.name}: town safe must be 6 to size - 2`);
  if (!(town.height >= 0 && town.height <= 3)) problems.push(`template ${t.name}: town height must be 0-3`);
  if (!(town.viewReach >= 0 && town.viewReach <= 3)) problems.push(`template ${t.name}: town view_reach must be 0-3`);
  if (!(town.houses.max >= 0 && town.houses.w >= 1 && town.houses.h >= 1)) problems.push(`template ${t.name}: town houses need max >= 0, w and h >= 1`);
  for (const k of ['ground', 'road', 'building', 'door'] as const) if (!town[k]) problems.push(`template ${t.name}: town ${k} terrain missing`);
  if (problems.length > 0) return problems;
  const unplaced = new Set<string>();
  for (let seed = 1; seed <= 20; seed++) for (const s of townPlan(t.width, t.height, town, seed).unplaced) unplaced.add(s);
  if (unplaced.size > 0) problems.push(`template ${t.name}: no room for ${[...unplaced].join(', ')}`);
  const services = town.buildings.map((b) => b.service);
  if (services.some((s) => !s) || new Set(services).size !== services.length) problems.push(`template ${t.name}: each building needs its own service`);
  return problems;
}
