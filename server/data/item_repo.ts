import type pg from 'pg';
import { stackKey, type Inventory } from '../inventory/bag.ts';
import {
  parseItem, parseMaterial, type ItemCatalog, type ItemEffect, type ItemTrigger, type MaterialDef,
} from '../inventory/items.ts';

// Item data and per-entity inventories. Writes take a client so they join the caller's transaction.

export async function loadItemCatalog(pool: pg.Pool): Promise<ItemCatalog> {
  const [materials, items, effects] = await Promise.all([
    pool.query<{ id: string; material_name: string; tags: string[]; data: Record<string, unknown> }>(
      'SELECT id, material_name, tags, data FROM item.materials',
    ),
    pool.query<{ item_name: string; type: string; shape: string | null; core_material_id: string | null; data: Record<string, unknown> }>(
      'SELECT item_name, type, shape, core_material_id, data FROM item.items',
    ),
    pool.query<{
      item_name: string; trigger: ItemTrigger; handler_key: string; power: string;
      duration_turns: number | null; chance: string; params: Record<string, unknown>;
    }>(
      `SELECT i.item_name, f.trigger, t.handler_key, f.power, f.duration_turns, f.chance, f.params
       FROM item.item_effects f
       JOIN item.items i ON i.id = f.item_id
       JOIN moves.effect_types t ON t.id = f.effect_type_id
       ORDER BY i.item_name, f.position`,
    ),
  ]);
  const byId = new Map<string, MaterialDef>(
    materials.rows.map((m) => [m.id, parseMaterial(m.material_name, m.tags, m.data)]),
  );
  const effectsOf = new Map<string, ItemEffect[]>();
  for (const f of effects.rows) {
    const list = effectsOf.get(f.item_name) ?? [];
    list.push({
      trigger: f.trigger,
      effect: {
        handler: f.handler_key, power: Number(f.power), durationTurns: f.duration_turns, chance: Number(f.chance), params: f.params,
      },
    });
    effectsOf.set(f.item_name, list);
  }
  return new Map(
    items.rows.map((i) => [
      i.item_name,
      parseItem(
        i.item_name, i.type, i.shape, i.core_material_id ? byId.get(i.core_material_id) ?? null : null, i.data,
        effectsOf.get(i.item_name) ?? [],
      ),
    ]),
  );
}

export async function loadInventory(pool: pg.Pool, entityId: string): Promise<Inventory> {
  const [stacks, pieces, known] = await Promise.all([
    pool.query<{ item_name: string; quality: string; qty: number; equipped_slot: string | null }>(
      `SELECT i.item_name, v.quality, v.qty, v.equipped_slot FROM item.inventory v JOIN item.items i ON i.id = v.item_id
       WHERE v.entity_id = $1`,
      [entityId],
    ),
    pool.query<{ id: string; item_name: string; durability: string; quality: string; equipped_slot: string | null; data: Record<string, unknown> }>(
      `SELECT p.id, i.item_name, p.durability, p.quality, p.equipped_slot, p.data
       FROM item.item_instances p JOIN item.items i ON i.id = p.item_id
       WHERE p.holder_entity_id = $1 ORDER BY p.created_at, p.id`,
      [entityId],
    ),
    pool.query<{ item_name: string }>(
      'SELECT i.item_name FROM item.known_items k JOIN item.items i ON i.id = k.item_id WHERE k.entity_id = $1',
      [entityId],
    ),
  ]);
  return {
    stacks: new Map(stacks.rows.map((s) => [
      stackKey(s.item_name, s.quality), { item: s.item_name, quality: s.quality, qty: s.qty, slot: s.equipped_slot },
    ])),
    pieces: pieces.rows.map((p) => ({
      id: p.id, item: p.item_name, durability: Number(p.durability), quality: p.quality, slot: p.equipped_slot, data: p.data,
    })),
    known: new Set(known.rows.map((k) => k.item_name)),
  };
}

// Replaces the entity's stacks, upserts its pieces (by id), drops pieces it no longer holds.
export async function writeInventory(client: pg.PoolClient, entityId: string, inv: Inventory): Promise<void> {
  const stacks = [...inv.stacks.values()];
  await client.query('DELETE FROM item.inventory WHERE entity_id = $1', [entityId]);
  await client.query(
    `INSERT INTO item.inventory (entity_id, item_id, qty, equipped_slot, quality)
     SELECT $1, i.id, x.qty, x.slot, x.quality FROM unnest($2::text[], $3::int[], $4::text[], $5::text[]) AS x(name, qty, slot, quality)
     JOIN item.items i ON i.item_name = x.name`,
    [entityId, stacks.map((s) => s.item), stacks.map((s) => s.qty), stacks.map((s) => s.slot), stacks.map((s) => s.quality)],
  );

  const ids = inv.pieces.map((p) => p.id);
  await client.query('DELETE FROM item.item_instances WHERE holder_entity_id = $1 AND NOT (id = ANY($2::uuid[]))', [entityId, ids]);
  // Clear slots first so swapped slots never collide on the unique (holder, slot) key.
  await client.query('UPDATE item.item_instances SET equipped_slot = NULL WHERE holder_entity_id = $1', [entityId]);
  await client.query(
    `INSERT INTO item.item_instances (id, item_id, holder_entity_id, durability, quality, equipped_slot, data)
     SELECT x.id, i.id, $1, x.durability, x.quality, x.slot, x.data
     FROM unnest($2::uuid[], $3::text[], $4::numeric[], $5::text[], $6::text[], $7::jsonb[]) AS x(id, name, durability, quality, slot, data)
     JOIN item.items i ON i.item_name = x.name
     ON CONFLICT (id) DO UPDATE SET holder_entity_id = EXCLUDED.holder_entity_id, durability = EXCLUDED.durability,
       quality = EXCLUDED.quality, equipped_slot = EXCLUDED.equipped_slot, data = EXCLUDED.data`,
    [entityId, ids, inv.pieces.map((p) => p.item), inv.pieces.map((p) => p.durability),
     inv.pieces.map((p) => p.quality), inv.pieces.map((p) => p.slot), inv.pieces.map((p) => JSON.stringify(p.data))],
  );

  await client.query(
    `INSERT INTO item.known_items (entity_id, item_id)
     SELECT $1, i.id FROM item.items i WHERE i.item_name = ANY($2::text[])
     ON CONFLICT DO NOTHING`,
    [entityId, [...inv.known]],
  );
}
