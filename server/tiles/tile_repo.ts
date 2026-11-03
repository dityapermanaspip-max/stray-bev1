import type pg from 'pg';

// The tile catalog (world.tiles): which drawings stand for which terrain. Server and client read the same rows; the
// client gets them as a generated file (server/tiles/export.ts), because the art is sliced before the game runs.

export type CatalogTile = {
  key: string; atlas: 'walk' | 'block' | 'obstacle'; terrain: string; biome: string; walkable: boolean;
  sheet: string | null; cell: number | null; mirrorOf: string | null; edge: string | null; edgeOf: string | null; weight: number; nodeKind: string | null;
};

export async function loadTiles(pool: pg.Pool): Promise<CatalogTile[]> {
  const res = await pool.query<CatalogTile>(
    `SELECT tile_key AS key, atlas, terrain, biome, walkable, sheet, cell, mirror_of AS "mirrorOf", edge, edge_of AS "edgeOf", weight, node_kind AS "nodeKind"
     FROM world.tiles ORDER BY tile_key`,
  );
  return res.rows;
}
