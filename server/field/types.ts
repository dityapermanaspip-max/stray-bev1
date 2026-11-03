// Field data. A field is generated from template + biome(s) + seed; only those are stored.

export type FieldKind = 'open' | 'corridor' | 'town' | 'interior'; // interior: a small room (server/interior)

// Shape: size, kind, and how obstacle density scales here. Towns add a layout for their safe middle.
export type FieldTemplate = { name: string; kind: FieldKind; width: number; height: number; obstacleMult: number; town: TownLayout | null; travel: 'x' | 'y' | null };
// travel (corridors): the way the long side runs; worldgen gives a border in hex direction 0 a x-template, 1 and 2 a y-template (see worldgen/corridor_templates.ts)

// A town's middle: a safe square of `safe` tiles at one height, a road cross through the centre, and buildings
// at random spots (server/field/town.ts). Each building is blocked except its door, which opens its service.
// viewReach: rows behind a building it hides, per tile of w + h. houses: door-less fillers, up to max.
export type TownLayout = {
  safe: number;
  height: number;
  ground: string;
  road: string;
  building: string;
  door: string;
  buildings: { service: string; w: number; h: number }[];
  viewReach: number;
  houses: { max: number; w: number; h: number };
};

// Look: ground and obstacle terrains (weights), how much is blocked, how hilly.
export type Biome = {
  name: string;
  ground: Record<string, number>;
  obstacles: Record<string, number>;
  obstacleDensity: number; // share of tiles blocked, before the template's obstacle_mult
  hills: { max: number; scale: number; steep: number }; // max level (0-3), hill size in tiles, contrast (1 = rolling, higher = plateaus and cliffs)
  lowland: { share: number; terrain: Record<string, number> }; // part of height-0 ground under water or swamp (blocked)
  nodes: Record<string, number>; // resource nodes per field by kind (rock, tree, herb, fish)
};

// blend: share of biome B along the field's length (corridors run from y = 0 to the far end).
export type FieldSpec = {
  template: FieldTemplate;
  biomeA: Biome;
  biomeB: Biome | null;
  blend: { from: number; to: number };
  seed: number;
  dir?: number; // a corridor: the hex direction (0-5) of its border from hex A to hex B; its exits follow it (exits.ts)
  gate?: boolean; // a hex that holds a town: a small walled town in the middle with a gate into the town field
};

// slope: always null now (flat blocks, climb.ts); kept for the view format.
// safe: inside a town's middle (no encounters). service: a town door (inn, shop, ...).
export type Tile = {
  terrain: string; biome: string; height: number; walkable: boolean; slope: number | null; safe?: boolean; service?: string | null;
};
export type Point = { x: number; y: number };
export type Exit = Point & { id: string }; // open fields: d0-d5 (hex directions); corridors: a (start), b (end)
// A resource node on a walkable tile. rank (0-1, fixed by the seed): the node is dark (corrupted) while the field's
// hidden corruption share is above it, so more nodes darken as corruption spreads.
export type ResourceNode = Point & { id: number; kind: string; rank: number };

export type FieldGrid = {
  width: number;
  height: number;
  tiles: Tile[]; // row-major: index = y * width + x
  spawn: Point; // field entry; in a town, the middle of the road cross (where a passed-out player wakes)
  exits: Exit[];
  nodes: ResourceNode[]; // placed by field/nodes.ts once the gather config is known (empty from generateField)
};

export const tileAt = (g: FieldGrid, x: number, y: number): Tile | undefined =>
  x >= 0 && y >= 0 && x < g.width && y < g.height ? g.tiles[y * g.width + x] : undefined;
