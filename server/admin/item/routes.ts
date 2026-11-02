import type pg from 'pg';
import { ITEM_TYPES, listItems, saveItem, type ItemDraft } from './items.ts';
import { listLoot, removeLootEntry, setLootEntry } from './loot.ts';
import { listRecipes, removeRecipe, saveRecipe, type RecipeDraft } from './recipes.ts';

// Admin item routes. GET /items?q=&type=  /item-ref  /loot  /recipes
// POST /item/save  /loot/entry  /loot/entry/remove  /recipe/save  /recipe/remove. Returns null for any other path.

export type Reply = { status: number; body: unknown };
type Body = Record<string, unknown>;
const done = (err: string | null): Reply => (err ? { status: 400, body: { error: err } } : { status: 200, body: { ok: true } });
const POSTS = ['/item/save', '/loot/entry', '/loot/entry/remove', '/recipe/save', '/recipe/remove'];

export async function itemRoute(pool: pg.Pool, method: string, path: string, params: URLSearchParams, readBody: () => Promise<Body>): Promise<Reply | null> {
  if (method === 'GET') {
    if (path === '/items') return { status: 200, body: { types: ITEM_TYPES, rows: await listItems(pool, params.get('q') ?? '', params.get('type') ?? '') } };
    if (path === '/loot') return { status: 200, body: await listLoot(pool) };
    if (path === '/recipes') return { status: 200, body: await listRecipes(pool) };
    if (path === '/item-ref') {
      const q = async (sql: string) => (await pool.query<{ n: string }>(sql)).rows.map((r) => r.n);
      return { status: 200, body: {
        items: await q('SELECT item_name AS n FROM item.items ORDER BY 1'),
        moves: await q('SELECT move_name AS n FROM moves.moves ORDER BY 1'),
        facilities: await q('SELECT DISTINCT facility_type AS n FROM item.recipes ORDER BY 1'),
      } };
    }
    return null;
  }
  if (method !== 'POST' || !POSTS.includes(path)) return null;
  const b = await readBody();
  if (path === '/item/save') return done(await saveItem(pool, b as unknown as ItemDraft));
  if (path === '/loot/entry') return done(await setLootEntry(pool, String(b.table ?? ''), String(b.item ?? ''), Number(b.chance), Number(b.min), Number(b.max)));
  if (path === '/loot/entry/remove') return done(await removeLootEntry(pool, String(b.table ?? ''), String(b.item ?? '')));
  if (path === '/recipe/save') return done(await saveRecipe(pool, b as unknown as RecipeDraft));
  return done(await removeRecipe(pool, String(b.name ?? '')));
}
