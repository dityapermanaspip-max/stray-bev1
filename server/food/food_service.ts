import type pg from 'pg';
import { inTransaction } from '../data/entity_save.ts';
import { loadInventory, writeInventory } from '../data/item_repo.ts';
import type { GameWorld } from '../game/world.ts';
import { statusPanel } from '../game/status_service.ts';
import type { SwapPlace } from '../loadout/loadout.ts';
import type { Rng } from '../util/rng.ts';
import type { StatusPanel } from '../../shared/town.ts';
import { canEat, mealActive, mealEnds, type Meal } from './food.ts';

// Eating from the bag (anywhere, not in battle): one food item is used up and becomes the meal, replacing any
// other. The field room says the end line when the meal runs out while the player is there.

export const FOOD_LINE_KEYS = ['food.start', 'food.end', 'food.cannot'];

type Ctx = { world: GameWorld; rng: Rng };

export async function loadMeal(pool: pg.Pool, entityId: string): Promise<Meal | null> {
  const row = (await pool.query<{ item_name: string; at: string }>(
    `SELECT i.item_name, (extract(epoch FROM m.eaten_at) * 1000)::bigint::text AS at
     FROM entity.meals m JOIN item.items i ON i.id = m.item_id WHERE m.entity_id = $1`, [entityId],
  )).rows[0];
  return row ? { item: row.item_name, eatenAt: Number(row.at) } : null;
}

export async function clearMeal(pool: pg.Pool, entityId: string): Promise<void> {
  await pool.query('DELETE FROM entity.meals WHERE entity_id = $1', [entityId]);
}

// When the current meal runs out (ms), or null when there is none (an old one is cleared).
export async function mealEndsAt(world: GameWorld, entityId: string): Promise<number | null> {
  const meal = await loadMeal(world.pool, entityId);
  if (mealActive(world.data.cfg, meal, Date.now())) return mealEnds(world.data.cfg, meal);
  if (meal) await clearMeal(world.pool, entityId);
  return null;
}

// ref: a bag ref (stack key or piece id) from the status window.
export async function eat(c: Ctx, entityId: string, place: SwapPlace, ref: string): Promise<{ panel: StatusPanel; endsAt: number | null }> {
  const { catalog, pool } = c.world;
  const inv = await loadInventory(pool, entityId);
  const stack = inv.stacks.get(ref);
  const piece = inv.pieces.find((p) => p.id === ref && !p.slot);
  const item = stack?.item ?? piece?.item;
  const say = (key: string) => c.world.data.lines.pick(c.rng, key, 0, 'self')?.text ?? null;
  if (!item || !canEat(catalog.get(item))) return { panel: await statusPanel(c, entityId, place, say('food.cannot')), endsAt: null };
  if (stack && --stack.qty <= 0) inv.stacks.delete(ref);
  if (piece) inv.pieces = inv.pieces.filter((p) => p !== piece);
  const now = Date.now();
  await inTransaction(pool, async (client) => {
    await writeInventory(client, entityId, inv);
    await client.query(
      `INSERT INTO entity.meals (entity_id, item_id, eaten_at) SELECT $1, i.id, to_timestamp($3 / 1000.0) FROM item.items i WHERE i.item_name = $2
       ON CONFLICT (entity_id) DO UPDATE SET item_id = EXCLUDED.item_id, eaten_at = EXCLUDED.eaten_at`,
      [entityId, item, now],
    );
  });
  return { panel: await statusPanel(c, entityId, place, say('food.start')), endsAt: mealEnds(c.world.data.cfg, { item, eatenAt: now }) };
}
