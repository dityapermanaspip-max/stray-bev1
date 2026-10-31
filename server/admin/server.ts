import { timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { loadItemCatalog } from '../data/item_repo.ts';
import { loadFieldData } from '../data/field_repo.ts';
import { loadLoot } from '../data/loot_repo.ts';
import { loadBattleData, loadRaces, loadSpecies } from '../data/species_repo.ts';
import { createPool } from '../db/pool.ts';
import { runSession } from '../sim/session_run.ts';
import { buildCatalog, playerFighter } from './catalog.ts';
import { runLabBattle, validateLab, type LabWorld } from './lab_battle.ts';
import { fieldCatalog, previewField } from './lab_field.ts';
import { butcherPreview } from './lab_loot.ts';
import type { LabBattleRequest, LabButcherRequest, LabFieldRequest, LabSessionRequest } from './lab_types.ts';

// Admin battle lab API. Dev only: localhost, token header, off unless ADMIN_ENABLED=true outside production.
// npm run admin   (the page is stray-fev2 /admin.html through the Vite dev server)

const HOST = '127.0.0.1';
const PREFIX = '/admin-api';
const MAX_BODY = 1_000_000;

const token = process.env.ADMIN_TOKEN ?? '';
if (process.env.ADMIN_ENABLED !== 'true' || process.env.NODE_ENV === 'production') {
  console.error('Admin lab is off. Set ADMIN_ENABLED=true in .env (never in production).');
  process.exit(1);
}
if (token.length < 16) {
  console.error('ADMIN_TOKEN in .env must be at least 16 characters.');
  process.exit(1);
}

const pool = createPool();
let world: LabWorld = await loadWorld();

async function loadWorld(): Promise<LabWorld> {
  const [data, species, races, catalog, loot, fields] = await Promise.all([
    loadBattleData(pool), loadSpecies(pool), loadRaces(pool), loadItemCatalog(pool), loadLoot(pool), loadFieldData(pool),
  ]);
  return { data, species, races, catalog, loot, fields };
}

function authorized(req: http.IncomingMessage): boolean {
  const given = Buffer.from(String(req.headers['x-admin-token'] ?? ''));
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

async function readJson<T>(req: http.IncomingMessage): Promise<T> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('request too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as T;
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${HOST}`);
  if (!url.pathname.startsWith(PREFIX)) return send(res, 404, { error: 'not found' });
  if (!authorized(req)) return send(res, 401, { error: 'bad or missing admin token' });
  const path = url.pathname.slice(PREFIX.length);

  if (req.method === 'GET' && path === '/catalog') return send(res, 200, await buildCatalog(pool, world));
  if (req.method === 'GET' && path === '/player') {
    const id = url.searchParams.get('id') ?? '';
    return send(res, 200, await playerFighter(pool, id));
  }
  if (req.method === 'POST' && path === '/reload') {
    world = await loadWorld();
    return send(res, 200, { ok: true });
  }
  if (req.method === 'POST' && path === '/battle') {
    const body = await readJson<LabBattleRequest>(req);
    const problem = validateLab(world, body);
    if (problem) return send(res, 400, { error: problem });
    return send(res, 200, runLabBattle(world, body));
  }
  if (req.method === 'GET' && path === '/fields') return send(res, 200, await fieldCatalog(pool, world.fields));
  if (req.method === 'POST' && path === '/field') {
    const result = await previewField(pool, world.fields, await readJson<LabFieldRequest>(req));
    return typeof result === 'string' ? send(res, 400, { error: result }) : send(res, 200, result);
  }
  if (req.method === 'POST' && path === '/butcher') {
    const result = butcherPreview(world, await readJson<LabButcherRequest>(req));
    return typeof result === 'string' ? send(res, 400, { error: result }) : send(res, 200, result);
  }
  if (req.method === 'POST' && path === '/session') {
    const b = await readJson<LabSessionRequest>(req);
    const fights = Math.min(500, Math.max(1, Number(b.fights) || 40));
    return send(res, 200, runSession(world, {
      fights,
      enemies: Array.isArray(b.enemies) ? b.enemies.map(String) : [],
      corruptedShare: Math.min(1, Math.max(0, Number(b.corruptedShare) || 0)),
      lowHpTier: Number(b.lowHpTier) || 2,
      seed: Number(b.seed) || 1,
      start: b.start ?? null,
    }));
  }
  return send(res, 404, { error: 'not found' });
}

const port = Number(process.env.ADMIN_PORT ?? 8787);
http
  .createServer((req, res) => {
    route(req, res).catch((err: Error) => send(res, 500, { error: err.message }));
  })
  .listen(port, HOST, () => console.log(`Admin lab API on http://${HOST}:${port}${PREFIX}`));

process.on('SIGINT', () => {
  void pool.end().then(() => process.exit(0));
});
