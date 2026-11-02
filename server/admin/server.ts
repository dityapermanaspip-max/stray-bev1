import { timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import { loadItemCatalog } from '../data/item_repo.ts';
import { loadFieldData } from '../data/field_repo.ts';
import { loadLoot } from '../data/loot_repo.ts';
import { loadBattleData, loadRaces, loadSpecies } from '../data/species_repo.ts';
import { createPool } from '../db/pool.ts';
import { createRng } from '../util/rng.ts';
import { rollCreature } from '../world/creature_roll.ts';
import { runSession } from '../sim/session_run.ts';
import { buildCatalog, playerFighter } from './catalog.ts';
import { runLabBattle, validateLab, type LabWorld } from './lab_battle.ts';
import { fieldCatalog, previewField } from './lab_field.ts';
import { inspectHex } from './world/hex_inspect.ts';
import { runTicks } from './world/run_ticks.ts';
import { entityRoute } from './entity/routes.ts';
import { itemRoute } from './item/routes.ts';
import { butcherPreview } from './lab_loot.ts';
import { aiBalanceMob, aiBalanceMove, aiDraft, aiMob, aiReady, type AiBalanceRequest, type AiMobRequest, type AiRequest } from './gemini.ts';
import { blankMob, exportMob, mobReference, type MobDraft } from './mob_draft.ts';
import { saveMob } from './mob_save.ts';
import { blankDraft, exportMove, moveReference, type MoveDraft } from './move_draft.ts';
import { saveMove } from './move_save.ts';
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
  const entity = await entityRoute(pool, req.method ?? 'GET', path, url.searchParams, () => readJson(req));
  if (entity) return send(res, entity.status, entity.body);
  const item = await itemRoute(pool, req.method ?? 'GET', path, url.searchParams, () => readJson(req));
  if (item) {
    if (req.method === 'POST' && item.status === 200) world = await loadWorld(); // the lab sees item, loot and recipe edits at once
    return send(res, item.status, item.body);
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
  // Move builder: reference names, an existing move as a draft, check or save (?mode=update edits it), AI fill and balance.
  if (req.method === 'GET' && path === '/move-ref') return send(res, 200, { ...(await moveReference(pool)), blank: blankDraft(), ai: aiReady() });
  if (req.method === 'GET' && path === '/move') {
    const draft = await exportMove(pool, url.searchParams.get('name') ?? '');
    return draft ? send(res, 200, draft) : send(res, 404, { error: 'unknown move' });
  }
  if (req.method === 'POST' && (path === '/move/check' || path === '/move/save')) {
    const result = await saveMove(pool, await readJson<MoveDraft>(req), path === '/move/save', url.searchParams.get('mode') === 'update');
    if (result.saved) world = await loadWorld(); // the battle lab sees it at once
    return send(res, 200, result);
  }
  if (req.method === 'POST' && path === '/move/ai') return send(res, 200, await aiDraft(pool, await readJson<AiRequest>(req)));
  if (req.method === 'POST' && path === '/move/balance') return send(res, 200, await aiBalanceMove(pool, await readJson<AiBalanceRequest<MoveDraft>>(req)));
  // Creature builder: the same shape of routes for species.
  if (req.method === 'GET' && path === '/mob-ref') return send(res, 200, { ...(await mobReference(pool)), blank: blankMob(), ai: aiReady() });
  if (req.method === 'GET' && path === '/mob') {
    const draft = await exportMob(pool, url.searchParams.get('name') ?? '');
    return draft ? send(res, 200, draft) : send(res, 404, { error: 'unknown creature' });
  }
  if (req.method === 'POST' && (path === '/mob/check' || path === '/mob/save')) {
    const result = await saveMob(pool, await readJson<MobDraft>(req), path === '/mob/save', url.searchParams.get('mode') === 'update');
    if (result.saved) world = await loadWorld();
    return send(res, 200, result);
  }
  if (req.method === 'GET' && path === '/mob/roll') { // five sample creatures as encounters would roll them
    const def = world.species.get(url.searchParams.get('name') ?? '');
    if (!def) return send(res, 404, { error: 'unknown creature (save it first)' });
    const ring = Number(url.searchParams.get('ring')) || world.data.cfg.rings.count;
    const rng = createRng(Date.now() >>> 0);
    return send(res, 200, Array.from({ length: 5 }, () => rollCreature(world.data.cfg, def, ring, url.searchParams.get('corrupted') === '1', rng)));
  }
  if (req.method === 'POST' && path === '/mob/ai') return send(res, 200, await aiMob(pool, await readJson<AiMobRequest>(req)));
  if (req.method === 'POST' && path === '/mob/balance') return send(res, 200, await aiBalanceMob(pool, await readJson<AiBalanceRequest<MobDraft>>(req)));
  if (req.method === 'GET' && path === '/fields') return send(res, 200, await fieldCatalog(pool, world.fields));
  if (req.method === 'POST' && path === '/field') {
    const result = await previewField(pool, world.fields, await readJson<LabFieldRequest>(req));
    return typeof result === 'string' ? send(res, 400, { error: result }) : send(res, 200, result);
  }
  if (req.method === 'GET' && path === '/hex') {
    const result = await inspectHex(pool, world, url.searchParams.get('ref') ?? '');
    return typeof result === 'string' ? send(res, 400, { error: result }) : send(res, 200, result);
  }
  if (req.method === 'POST' && path === '/ticks') { // run N world hours now (admin/world/run_ticks.ts)
    const hours = Number(url.searchParams.get('hours'));
    if (!Number.isInteger(hours) || hours < 1 || hours > 24 * 365) return send(res, 400, { error: 'hours must be 1 to 8760' });
    return send(res, 200, await runTicks(pool, hours));
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
