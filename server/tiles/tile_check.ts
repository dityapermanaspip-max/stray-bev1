import type { InteriorConfig } from '../config/interior_config.ts';
import type { CatalogTile } from './tile_repo.ts';

// Startup check of the tile catalog: art cells are used once, mirrors copy a tile of the same atlas, a terrain is
// either walkable or not in all its rows, and a room's floors, walls and props agree with the catalog.

const SHEET_CELLS = 15;

export function findTileProblems(tiles: CatalogTile[], rooms: InteriorConfig['rooms']): string[] {
  const out: string[] = [];
  const byKey = new Map(tiles.map((t) => [t.key, t]));
  const cells = new Set<string>();
  for (const t of tiles) {
    if (t.sheet !== null) {
      const at = `${t.sheet}:${t.cell}`;
      if (cells.has(at)) out.push(`tile ${t.key}: ${at} is used by another tile`);
      cells.add(at);
      if ((t.cell ?? 0) >= SHEET_CELLS) out.push(`tile ${t.key}: cell ${t.cell} is past the sheet`);
    }
    const src = t.mirrorOf ? byKey.get(t.mirrorOf) : null;
    if (t.mirrorOf && (!src || src.atlas !== t.atlas || src.mirrorOf)) out.push(`tile ${t.key}: mirrors ${t.mirrorOf}, which is not a drawn tile of the ${t.atlas} atlas`);
  }
  const walk = new Map<string, boolean>();
  for (const t of tiles) {
    if (walk.has(t.terrain) && walk.get(t.terrain) !== t.walkable) out.push(`terrain ${t.terrain}: some tiles are walkable and some not`);
    walk.set(t.terrain, t.walkable);
  }
  for (const [name, r] of Object.entries(rooms)) {
    if (walk.get(r.floor) === false) out.push(`room ${name}: floor ${r.floor} is not walkable in the tile catalog`);
    if (r.wall && walk.get(r.wall) === true) out.push(`room ${name}: wall ${r.wall} is walkable in the tile catalog`);
    for (const p of r.props) if (walk.get(p.terrain) === true) out.push(`room ${name}: ${p.terrain} is walkable in the tile catalog, but the room blocks it`);
  }
  return out;
}
