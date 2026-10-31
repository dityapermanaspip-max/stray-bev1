// Field data. A field is generated from template + biome(s) + seed; only those are stored.

export type FieldKind = 'open' | 'corridor' | 'town';

// Shape: size, kind, and how obstacle density scales here. Towns add a layout for their safe middle.
export type FieldTemplate = { name: string; kind: FieldKind; width: number; height: number; obstacleMult: number; town: TownLayout | null };

// A town's middle: a safe square of `safe` tiles at one height, a road cross through the centre, and
// buildings along the road. Each building is blocked except its door, which opens its service.
export type TownLayout = {
  safe: number;
  height: number;
  ground: string;
  road: string;
  building: string;
  door: string;
  buildings: { service: string; w: number; h: number }[];
};

// Look: ground and obstacle terrains (weights), how much is blocked, how hilly.
export type Biome = {
  name: string;
  ground: Record<string, number>;
  obstacles: Record<string, number>;
  obstacleDensity: number; // share of tiles blocked, before the template's obstacle_mult
  hills: { max: number; scale: number; steep: number }; // max level (0-3), hill size in tiles, contrast (1 = rolling, higher = plateaus and cliffs)
  lowland: { share: number; terrain: Record<string, number> }; // part of height-0 ground under water or swamp (blocked)
  slopeShare: number; // part of cliff edges that get a slope (more are added where needed to keep fields connected)
};

// blend: share of biome B along the field's length (corridors run from y = 0 to the far end).
export type FieldSpec = {
  template: FieldTemplate;
  biomeA: Biome;
  biomeB: Biome | null;
  blend: { from: number; to: number };
  seed: number;
};

// slope: the uphill direction (index into climb.ts STEPS), or null for flat ground.
// safe: inside a town's middle (no encounters). service: a town door (inn, shop, ...).
export type Tile = {
  terrain: string; biome: string; height: number; walkable: boolean; slope: number | null; safe?: boolean; service?: string | null;
};
export type Point = { x: number; y: number };
export type Exit = Point & { id: string }; // open fields: d0-d5 (hex directions); corridors: a (start), b (end)

export type FieldGrid = {
  width: number;
  height: number;
  tiles: Tile[]; // row-major: index = y * width + x
  spawn: Point; // field entry; in a town, the middle of the road cross (where a passed-out player wakes)
  exits: Exit[];
};

export const tileAt = (g: FieldGrid, x: number, y: number): Tile | undefined =>
  x >= 0 && y >= 0 && x < g.width && y < g.height ? g.tiles[y * g.width + x] : undefined;
