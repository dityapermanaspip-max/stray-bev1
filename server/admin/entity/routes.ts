import type pg from 'pg';
import { ENTITY_KINDS, listEntities } from './list.ts';
import { entitySheet } from './sheet.ts';
import { removeKnownMove, renameEntity, setBaseStat, setKnownMove } from './edit.ts';

// Admin entity routes (characters, NPCs, recruits ...). Returns null when the path is not an entity route.
// GET /entities?kind=&q=   GET /entity?id=   POST /entity/rename|stat|move|move/remove

export type Reply = { status: number; body: unknown };
type Body = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const done = (err: string | null): Reply => (err ? { status: 400, body: { error: err } } : { status: 200, body: { ok: true } });

export async function entityRoute(
  pool: pg.Pool, method: string, path: string, params: URLSearchParams, readBody: () => Promise<Body>,
): Promise<Reply | null> {
  if (method === 'GET' && path === '/entities') {
    const kind = params.get('kind') ?? '';
    if (kind && !(ENTITY_KINDS as readonly string[]).includes(kind)) return { status: 400, body: { error: 'unknown kind' } };
    return { status: 200, body: { kinds: ENTITY_KINDS, rows: await listEntities(pool, kind, params.get('q') ?? '') } };
  }
  if (method === 'GET' && path === '/entity') {
    const id = params.get('id') ?? '';
    const sheet = UUID.test(id) ? await entitySheet(pool, id) : null;
    return sheet ? { status: 200, body: sheet } : { status: 404, body: { error: 'unknown entity' } };
  }
  if (method !== 'POST' || !path.startsWith('/entity/')) return null;
  const b = await readBody();
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return { status: 400, body: { error: 'bad entity id' } };
  if (path === '/entity/rename') return done(await renameEntity(pool, id, String(b.name ?? '')));
  if (path === '/entity/stat') return done(await setBaseStat(pool, id, String(b.stat ?? ''), Number(b.base)));
  if (path === '/entity/move') return done(await setKnownMove(pool, id, String(b.move ?? ''), Number(b.level)));
  if (path === '/entity/move/remove') return done(await removeKnownMove(pool, id, String(b.move ?? '')));
  return null;
}
