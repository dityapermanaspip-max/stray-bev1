import { randomInt } from 'node:crypto';
import { loadRecruitData, rollSummoner } from '../recruit/recruit_repo.ts';
import { createRng } from '../util/rng.ts';
import type pg from 'pg';
import type { BattleData } from '../battle/types.ts';
import { findEntityByName, loadEntityState } from '../data/entity_load.ts';
import { createPlayer, saveBag } from '../data/entity_save.ts';
import { currentRoundId, fieldSpec, loadFieldData, loadLinks, type FieldData } from '../data/field_repo.ts';
import { loadInventory, loadItemCatalog } from '../data/item_repo.ts';
import { loadPopulation } from '../data/population_repo.ts';
import { loadPosition, savePosition, type Position } from '../data/position_repo.ts';
import { loadRecipes, type Recipe } from '../data/economy_repo.ts';
import { loadBattleData, loadSpecies, type SpeciesDef } from '../data/species_repo.ts';
import { buildInterior } from '../interior/interior_grid.ts';
import { parseInterior } from '../interior/interior_ref.ts';
import { exitTiles } from '../field/exits.ts';
import { generateField } from '../field/generate.ts';
import { loadNodeLoot } from '../gather/gather_repo.ts';
import { placeNodes } from '../field/nodes.ts';
import type { Hex, WorldLinks } from '../field/links.ts';
import { tileAt, type FieldGrid, type FieldKind } from '../field/types.ts';
import { progressStats } from '../growth/level_up.ts';
import { carriedWeight, loadTier } from '../inventory/bag.ts';
import { addCoins } from '../inventory/money.ts';
import type { ItemCatalog } from '../inventory/items.ts';
import type { LootEntry } from '../inventory/loot.ts';
import { calcDerived } from '../stats/derived.ts';
import { blendRows } from '../world/encounter.ts';
import type { PopRow } from '../world/population.ts';
import { hexDistance } from '../world/world_hour.ts';
import type { FieldView } from '../../shared/field.ts';

// What the game server keeps in memory: data loaded once, plus generated fields (a cache; the DB stays the truth).

export type GameWorld = {
  pool: pg.Pool;
  data: BattleData;
  catalog: ItemCatalog;
  species: Map<string, SpeciesDef>;
  recipes: Recipe[]; // town craftsman recipes (item.recipes)
  crafted: Set<string>; // finished craftsman goods (the shop shelf sells these)
  fields: FieldData;
  links: WorldLinks;
  roundId: string;
  grids: Map<string, { grid: FieldGrid; kind: FieldKind }>;
  nodeLoot: Map<string, LootEntry[]>; // resource node finds by table (node_<kind>_native / _corrupted)
};

export async function loadGameWorld(pool: pg.Pool): Promise<GameWorld> {
  const roundId = await currentRoundId(pool);
  if (!roundId) throw new Error('no round: run npm run db:seed or npm run world:new');
  const [data, catalog, species, recipes, fields, links, nodeLoot] = await Promise.all([
    loadBattleData(pool), loadItemCatalog(pool), loadSpecies(pool), loadRecipes(pool), loadFieldData(pool), loadLinks(pool, roundId),
    loadNodeLoot(pool),
  ]);
  // Finished craftsman goods: made by a recipe and not the input of another (raw hide and tanned leather are not).
  const inputs = new Set(recipes.flatMap((r) => r.inputs.map((x) => x.item)));
  const crafted = new Set(recipes.flatMap((r) => r.outputs.map((x) => x.item)).filter((item) => !inputs.has(item)));
  return { pool, data, catalog, species, recipes, crafted, fields, links, roundId, grids: new Map(), nodeLoot };
}

export async function gridFor(world: GameWorld, ref: string): Promise<{ grid: FieldGrid; kind: FieldKind } | null> {
  const cached = world.grids.get(ref);
  if (cached) return cached;
  const room = parseInterior(ref);
  if (room) { // a room: built from its layout alone
    const layout = world.data.cfg.interior.rooms[room.kind];
    if (!layout || !inRound(world, room.parent)) return null;
    const entry = { grid: buildInterior(layout), kind: 'interior' as const };
    world.grids.set(ref, entry);
    return entry;
  }
  const spec = await fieldSpec(world.pool, world.fields, ref);
  if (!spec) return null;
  const grid = generateField(spec);
  const near = Object.fromEntries(Object.entries(world.data.cfg.gather.kinds).map(([k, v]) => [k, v.near]));
  const on = Object.fromEntries(Object.entries(world.data.cfg.gather.kinds).map(([k, v]) => [k, v.on]));
  const wild = world.data.cfg.interior.wild; // a camp or cave is a node too: walked beside, then gone into
  grid.nodes = placeNodes(grid, spec, near, (k) => !!world.data.cfg.gather.kinds[k] || !!wild[k], on); // only kinds in config
  const entry = { grid, kind: spec.template.kind };
  world.grids.set(ref, entry);
  return entry;
}

export function fieldView(ref: string, kind: FieldKind, g: FieldGrid, rank: string[]): FieldView {
  return {
    ref, rank, kind, width: g.width, height: g.height,
    tiles: g.tiles.map((t) => ({ t: t.terrain, b: t.biome, h: t.height, w: t.walkable, s: t.slope ?? -1, safe: !!t.safe, door: t.service ?? null })),
    exits: exitTiles(g.exits, g.width, g.height, kind).map((e) => ({ id: e.id, x: e.x, y: e.y })), // widened: the client draws every tile
    nodes: g.nodes.filter((n) => n.kind !== 'npc').map((n) => ({ x: n.x, y: n.y, kind: n.kind })),
    npcs: [],
  };
}

// A field of the round being played (hex, town or corridor), or a room hanging off one.
export function inRound(world: GameWorld, ref: string): boolean {
  const room = parseInterior(ref);
  if (room) return !!world.data.cfg.interior.rooms[room.kind] && inRound(world, room.parent);
  return world.links.hexes.has(ref) || world.links.towns.has(ref) || world.links.borders.some((b) => b.corridors.includes(ref));
}

// Where a stray is summoned: the first corridor out of a town on the outermost ring that has towns, at its exit
// into the town. Which way they walk first is their destiny. Without such a corridor: the hex nearest the centre.
async function strayStart(world: GameWorld): Promise<Position> {
  const ring = (h: Hex) => hexDistance({ q: 0, r: 0 }, h);
  const outer = Math.max(...[...world.links.hexes.values()].filter((h) => h.town).map(ring));
  const spots = world.links.borders.flatMap((b) => [
    ...(b.a.town && ring(b.a) === outer && b.corridors.length > 0 ? [{ ref: b.corridors[0], exit: 'a' }] : []),
    ...(b.b.town && ring(b.b) === outer && b.corridors.length > 0 ? [{ ref: b.corridors[b.corridors.length - 1], exit: 'b' }] : []),
  ]);
  const spot = spots[Math.floor(Math.random() * spots.length)];
  if (spot) {
    const { grid } = (await gridFor(world, spot.ref))!;
    const exit = grid.exits.find((e) => e.id === spot.exit) ?? grid.spawn;
    return { fieldRef: spot.ref, x: exit.x, y: exit.y };
  }
  const centre = [...world.links.hexes.values()].sort((a, b) => ring(a) - ring(b))[0];
  const { grid } = (await gridFor(world, centre.id))!;
  return { fieldRef: centre.id, x: grid.spawn.x, y: grid.spawn.y };
}

// A new player: created with the start moves, then given the starting purse.
async function newPlayer(world: GameWorld, name: string): Promise<string> {
  const { cfg } = world.data;
  const id = await createPlayer(world.pool, cfg, name, 'human');
  const inv = await loadInventory(world.pool, id);
  addCoins(cfg, world.catalog, inv, cfg.town.startCopper);
  await saveBag(world.pool, id, inv);
  // Their summoner is rolled now, somewhere in the world; whether they ever meet is another story.
  const recruits = await loadRecruitData(world.pool);
  await rollSummoner({ pool: world.pool, cfg, catalog: world.catalog, unlocks: world.data.unlocks, roundId: world.roundId, ...recruits },
    id, createRng(randomInt(2 ** 31)));
  return id;
}

// Dev join: find or create the player by name, and make sure they stand on a walkable tile of a real field.
export async function placePlayer(world: GameWorld, name: string): Promise<{ entityId: string; position: Position }> {
  const { pool } = world;
  const entityId = (await findEntityByName(pool, 'player', name)) ?? (await newPlayer(world, name));
  let position = await loadPosition(pool, entityId);
  // A field of an ended round (or none): summoned anew as a stray. A bad tile in a real field: its spawn.
  const field = position && inRound(world, position.fieldRef) ? await gridFor(world, position.fieldRef) : null;
  if (!position || !field) {
    position = await strayStart(world);
    await savePosition(pool, entityId, position);
  } else if (!tileAt(field.grid, position.x, position.y)?.walkable) {
    position = { fieldRef: position.fieldRef, x: field.grid.spawn.x, y: field.grid.spawn.y };
    await savePosition(pool, entityId, position);
  }
  return { entityId, position };
}

// What walking needs from the player: load tier from what they carry (1 light .. 4 stuck), and luck for encounters.
export async function walkerStats(world: GameWorld, entityId: string): Promise<{ tier: number; luck: number }> {
  const { cfg } = world.data;
  const [state, inv] = await Promise.all([loadEntityState(world.pool, entityId), loadInventory(world.pool, entityId)]);
  const stats = progressStats(state.progress);
  const max = calcDerived(stats, cfg.derived).maxInventoryWeight;
  return { tier: loadTier(cfg, carriedWeight(cfg, world.catalog, inv), max), luck: stats.luck };
}

// Creatures of a field: a hex's own rows; a corridor mixes its two hexes by its place in the chain.
export async function populationFor(world: GameWorld, ref: string): Promise<PopRow[]> {
  if (world.links.hexes.has(ref)) return (await loadPopulation(world.pool, [ref])).get(ref)!;
  const border = world.links.borders.find((b) => b.corridors.includes(ref));
  if (!border) return [];
  const pops = await loadPopulation(world.pool, [border.a.id, border.b.id]);
  const shareB = (border.corridors.indexOf(ref) + 0.5) / border.corridors.length;
  return blendRows(pops.get(border.a.id)!, pops.get(border.b.id)!, shareB);
}

// The biggest group a field sends: capped in the corridor next to a town (the first one out of it), where strays
// are summoned; everywhere else the density rule alone.
export function groupCapFor(world: GameWorld, ref: string): number {
  const { encounter } = world.data.cfg;
  const nearTown = world.links.borders.some((b) =>
    (b.a.town && b.corridors[0] === ref) || (b.b.town && b.corridors[b.corridors.length - 1] === ref));
  return nearTown ? encounter.nearTownGroupMax : encounter.groupMax;
}

// Where a field's creatures are counted: a hex itself, or for a corridor the hex it lies nearer to.
export function populationHome(world: GameWorld, ref: string): string | null {
  if (world.links.hexes.has(ref)) return ref;
  const border = world.links.borders.find((b) => b.corridors.includes(ref));
  if (!border) return null;
  return (border.corridors.indexOf(ref) + 0.5) / border.corridors.length < 0.5 ? border.a.id : border.b.id;
}
