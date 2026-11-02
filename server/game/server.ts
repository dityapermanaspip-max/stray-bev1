import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { clearBattles } from '../data/battle_repo.ts';
import { createPool } from '../db/pool.ts';
import { BATTLE_ROOM } from '../../shared/battle.ts';
import { BattleRoom } from './battle_room.ts';
import { FIELD_ROOM, type WhereAnswer } from '../../shared/field.ts';
import { FieldRoom } from './field_room.ts';
import { startTicker } from './ticker.ts';
import { reloadVices } from '../vice/vice_finder.ts';
import { fillMovelessVices } from '../vice/vice_repo.ts';
import { createRng } from '../util/rng.ts';
import { loadGameWorld, placePlayer } from './world.ts';

// Game server (Colyseus). Dev only for now: players join by name, no password, localhost only.
// npm run game   (needs DEV_JOIN=true in .env; never in production)

if (process.env.DEV_JOIN !== 'true' || process.env.NODE_ENV === 'production') {
  console.error('Game server dev join is off. Set DEV_JOIN=true in .env (never in production).');
  process.exit(1);
}

const HOST = '127.0.0.1';
const port = Number(process.env.GAME_PORT ?? 2567);
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const NAME = /^[A-Za-z0-9_]{2,24}$/;

// The two express calls used here (express ships with the Colyseus transport; no extra typings).
type Req = { query: Record<string, unknown> };
type Res = { set(key: string, value: string): Res; status(code: number): Res; json(body: unknown): void };

const pool = createPool();
FieldRoom.world = await loadGameWorld(pool);
BattleRoom.world = FieldRoom.world;
const filled = await fillMovelessVices(pool, FieldRoom.world.data.cfg, FieldRoom.world.roundId, createRng(Date.now() >>> 0));
if (filled > 0) console.log(`Gave moves to ${filled} vice(s).`);
await reloadVices(pool, FieldRoom.world.roundId); // where the living vices stand (a cache; the DB is the truth)
const stale = await clearBattles(pool); // battles are not resumed after a restart yet
if (stale > 0) console.log(`Cleared ${stale} unfinished battle(s).`);

const server = defineServer({
  greet: false,
  transport: new WebSocketTransport(),
  rooms: { [FIELD_ROOM]: defineRoom(FieldRoom).filterBy(['ref']), [BATTLE_ROOM]: defineRoom(BattleRoom) },
  // Which field a player stands in, so the client joins the right room. Creates the player on first use.
  express: (app) => {
    app.get('/dev/where', async (req: Req, res: Res) => {
      res.set('Access-Control-Allow-Origin', clientOrigin);
      const name = String(req.query.name ?? '');
      if (!NAME.test(name)) return void res.status(400).json({ error: 'bad_name' });
      try {
        const placed = await placePlayer(FieldRoom.world, name);
        const answer: WhereAnswer = { ref: placed.position.fieldRef, name };
        res.json(answer);
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    });
  },
});

await server.listen(port, HOST);
await startTicker(FieldRoom.world); // population rules and town ticks, world hours
console.log(`Game server on ws://${HOST}:${port} (dev join)`);
