import type pg from 'pg';
import { fieldSpec } from '../../data/field_repo.ts';
import { loadPopulation } from '../../data/population_repo.ts';
import { generateField } from '../../field/generate.ts';
import { corruptionShare, isDark, placeNodes } from '../../field/nodes.ts';
import type { LabWorld } from '../lab_battle.ts';

// Hex inspector (admin lab only, so hidden numbers are fine here): everything stored for one hex or corridor of the
// round. The field as the game builds it with its resource nodes, the hex row, creature counts and the corruption
// share, corpses, who stands there, and for towns the economy, stock and keepers. Read only.

const rows = async (pool: pg.Pool, sql: string, ref: string) => (await pool.query(sql, [ref])).rows;

export async function inspectHex(pool: pg.Pool, world: LabWorld, ref: string) {
  const spec = await fieldSpec(pool, world.fields, ref);
  if (!spec) return `unknown field ${ref}`;
  const grid = generateField(spec);
  const kinds = world.data.cfg.gather.kinds;
  grid.nodes = placeNodes(grid, spec, Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, v.near])), (k) => !!kinds[k], Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, v.on])));

  const [hex, pop, taken, corpses, people, economy, stock, keepers] = await Promise.all([
    rows(pool, `SELECT h.q, h.r, h.ring, h.field_kind, h.field_template, h.biome, h.field_seed::text AS seed, k.name AS kingdom,
                  h.stronghold, h.defense, h.has_temple, h.has_info_guild, v.name AS vice
                FROM world.hexes h LEFT JOIN world.kingdoms k ON k.id = h.owner_kingdom_id LEFT JOIN entity.entities v ON v.id = h.vice_entity_id
                WHERE h.id::text = $1`, ref),
    loadPopulation(pool, [ref]).then((m) => m.get(ref) ?? []),
    rows(pool, 'SELECT node, taken FROM world.field_nodes WHERE field_ref = $1', ref),
    rows(pool, `SELECT s.species_name AS species, c.corrupted, c.dissected, c.total_stats, c.killed_at
                FROM world.corpses c JOIN entity.species s ON s.id = c.species_id WHERE c.field_ref = $1 ORDER BY c.killed_at DESC`, ref),
    rows(pool, `SELECT e.name, e.kind, e.alive, p.x, p.y, p.updated_at FROM world.entity_positions p JOIN entity.entities e ON e.id = p.entity_id
                WHERE p.field_ref = $1 ORDER BY e.kind, e.name`, ref),
    rows(pool, `SELECT e.town_ref AS town, purse, max_buy, specialties, facilities, population, jobs FROM world.town_economy e
                WHERE e.town_ref = $1 OR e.town_ref = (SELECT id::text FROM world.towns WHERE hex_id::text = $1)`, ref), // the town, or the town in this hex
    rows(pool, `SELECT i.item_name AS item, s.quality, s.qty FROM world.town_stock s JOIN item.items i ON i.id = s.item_id
                WHERE (s.town_ref = $1 OR s.town_ref = (SELECT id::text FROM world.towns WHERE hex_id::text = $1)) AND s.qty > 0 ORDER BY i.item_name, s.quality`, ref),
    rows(pool, `SELECT k.service, e.name, e.alive FROM world.town_keepers k JOIN entity.entities e ON e.id = k.entity_id
                WHERE (k.town_ref = $1 OR k.town_ref = (SELECT id::text FROM world.towns WHERE hex_id::text = $1)) ORDER BY k.service`, ref),
  ]);
  const share = corruptionShare(pop);
  const used = new Map(taken.map((t) => [Number(t.node), Number(t.taken)]));
  return {
    grid: { ...grid, blockedShare: grid.tiles.filter((t) => !t.walkable).length / grid.tiles.length },
    hex: hex[0] ?? null, // null for a corridor
    corruption: share,
    population: pop,
    nodes: grid.nodes.map((n) => ({
      id: n.id, kind: n.kind, x: n.x, y: n.y, rank: n.rank, dark: isDark(n, share), taken: used.get(n.id) ?? 0, uses: kinds[n.kind].uses,
    })),
    corpses, people,
    town: economy[0] ? { ...economy[0], stock, keepers } : null,
  };
}
