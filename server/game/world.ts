import type pg from 'pg';
import type { BattleData } from '../battle/types.ts';
import { findEntityByName, loadEntityState } from '../data/entity_load.ts';
import { createPlayer, saveBag } from '../data/entity_save.ts';
import { devRoundId, fieldSpec, loadFieldData, loadLinks, type FieldData } from '../data/field_repo.ts';
import { loadInventory, loadItemCatalog } from '../data/item_repo.ts';
import { loadPopulation } from '../data/population_repo.ts';
import { loadPosition, savePosition, type Position } from '../data/position_repo.ts';
import { loadCrafts, type Craft } from '../data/economy_repo.ts';
import { loadBattleData, loadSpecies, type SpeciesDef } from '../data/species_repo.ts';
import { generateField } from '../field/generate.ts';
import type { WorldLinks } from '../field/links.ts';
import { tileAt, type FieldGrid, type FieldKind } from '../field/types.ts';
import { progressStats } from '../growth/level_up.ts';
import { carriedWeight, loadTier } from '../inventory/bag.ts';
import { addCoins } from '../inventory/money.ts';
import type { ItemCatalog } from '../inventory/items.ts';
import { calcDerived } from '../stats/derived.ts';
import { blendRows } from '../world/encounter.ts';
import type { PopRow } from '../world/population.ts';
import type { FieldView } from '../../shared/field.ts';

// What the game server keeps in memory: data loaded once, plus generated fields (a cache; the DB stays the truth).

export type GameWorld = {
  pool: pg.Pool;
  data: BattleData;
  catalog: ItemCatalog;
  species: Map<string, SpeciesDef>;
  crafts: Craft[];
  fields: FieldData;
  links: WorldLinks;
  roundId: string;
  grids: Map<string, { grid: FieldGrid; kind: FieldKind }>;
};

export async function loadGameWorld(pool: pg.Pool): Promise<GameWorld> {
  const roundId = await devRoundId(pool);
  if (!roundId) throw new Error('no dev round: run npm run db:seed');
  const [data, catalog, species, crafts, fields, links] = await Promise.all([
    loadBattleData(pool), loadItemCatalog(pool), loadSpecies(pool), loadCrafts(pool), loadFieldData(pool), loadLinks(pool, roundId),
  ]);
  return { pool, data, catalog, species, crafts, fields, links, roundId, grids: new Map() };
}

export async function gridFor(world: GameWorld, ref: string): Promise<{ grid: FieldGrid; kind: FieldKind } | null> {
  const cached = world.grids.get(ref);
  if (cached) return cached;
  const spec = await fieldSpec(world.pool, world.fields, ref);
  if (!spec) return null;
  const entry = { grid: generateField(spec), kind: spec.template.kind };
  world.grids.set(ref, entry);
  return entry;
}

export function fieldView(ref: string, kind: FieldKind, g: FieldGrid): FieldView {
  return {
    ref, kind, width: g.width, height: g.height,
    tiles: g.tiles.map((t) => ({ t: t.terrain, b: t.biome, h: t.height, w: t.walkable, s: t.slope ?? -1, safe: !!t.safe, door: t.service ?? null })),
    exits: g.exits.map((e) => ({ id: e.id, x: e.x, y: e.y })),
  };
}

// Where new players start: a town of the round if there is one, else the hex nearest the centre.
async function startHex(world: GameWorld): Promise<string> {
  const res = await world.pool.query<{ id: string }>(
    `SELECT id::text FROM world.hexes WHERE round_id = $1 ORDER BY (field_kind = 'town') DESC, abs(q) + abs(r), q LIMIT 1`,
    [world.roundId],
  );
  return res.rows[0].id;
}

// A new player: created with the start moves, then given the starting purse.
async function newPlayer(world: GameWorld, name: string): Promise<string> {
  const { cfg } = world.data;
  const id = await createPlayer(world.pool, cfg, name, 'human');
  const inv = await loadInventory(world.pool, id);
  addCoins(cfg, world.catalog, inv, cfg.town.startCopper);
  await saveBag(world.pool, id, inv);
  return id;
}

// Dev join: find or create the player by name, and make sure they stand on a walkable tile of a real field.
export async function placePlayer(world: GameWorld, name: string): Promise<{ entityId: string; position: Position }> {
  const { pool } = world;
  const entityId = (await findEntityByName(pool, 'player', name)) ?? (await newPlayer(world, name));
  let position = await loadPosition(pool, entityId);
  const field = position ? await gridFor(world, position.fieldRef) : null;
  if (!position || !field || !tileAt(field.grid, position.x, position.y)?.walkable) {
    const ref = field ? position!.fieldRef : await startHex(world);
    const { grid } = (await gridFor(world, ref))!;
    position = { fieldRef: ref, x: grid.spawn.x, y: grid.spawn.y };
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

// Where a field's creatures are counted: a hex itself, or for a corridor the hex it lies nearer to.
export function populationHome(world: GameWorld, ref: string): string | null {
  if (world.links.hexes.has(ref)) return ref;
  const border = world.links.borders.find((b) => b.corridors.includes(ref));
  if (!border) return null;
  return (border.corridors.indexOf(ref) + 0.5) / border.corridors.length < 0.5 ? border.a.id : border.b.id;
}
