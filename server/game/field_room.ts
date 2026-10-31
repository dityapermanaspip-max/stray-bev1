import { CloseCode, matchMaker, Room, type Client } from '@colyseus/core';
import { savePosition, saveWake } from '../data/position_repo.ts';
import { linkExit } from '../field/links.ts';
import { findPath } from '../field/path.ts';
import { isSafe } from '../field/town.ts';
import { tileAt, type FieldGrid, type FieldKind } from '../field/types.ts';
import { advance, newWalker, walkSpeed, type Walker } from '../field/walker.ts';
import { openService, useService } from '../town/doors.ts';
import { createRng } from '../util/rng.ts';
import { rollEncounter, type Foe } from '../world/encounter.ts';
import type { PopRow } from '../world/population.ts';
import { BATTLE_ROOM } from '../../shared/battle.ts';
import type { EncounterNotice, FieldLine, FieldView, JoinOptions, TravelOrder, WalkRequest } from '../../shared/field.ts';
import type { GearRequest, LoadoutRequest, ServiceRequest } from '../../shared/town.ts';
import type { BattleOrder } from './battle_setup.ts';
import { FieldPlayer, FieldState } from './field_state.ts';
import { changeGear, changeLoadout, statusPanel } from './status_service.ts';
import { fieldView, gridFor, placePlayer, populationFor, walkerStats, type GameWorld } from './world.ts';

// One room per field (hex or corridor). Shared and cheap: walking only. Encounters hand the player to a
// private battle room and they leave this one; they come back to the same tile when it is over.
// The server finds every path and moves every player; the client only asks "walk to tile".

// grace: steps left before encounters can roll again (after entering the field or an encounter).
// door: the town service of the door the player stopped on, if any.
type Seat = { entityId: string; name: string; walker: Walker; speed: number; luck: number; grace: number; leaving: boolean; door: string | null };
type FieldClient = Client<{ userData: Seat }>;

const TICK_MS = 50;
const RECONNECT_SECONDS = 20;
const TRAVEL_GRACE_MS = 5000;
const NAME = /^[A-Za-z0-9_]{2,24}$/;

export class FieldRoom extends Room<{ state: FieldState; client: FieldClient }> {
  static world: GameWorld; // set once by the game server before it listens
  state = new FieldState();
  private ref = '';
  private kind: FieldKind = 'open';
  private grid!: FieldGrid;
  private view!: FieldView;
  private population: PopRow[] = []; // hidden counts; towns have none (safe)
  private rng = createRng(Date.now() >>> 0);

  messages = {
    walk: (client: FieldClient, msg: WalkRequest) => this.walk(client, msg),
    view: (): FieldView => this.view, // request: the tile grid, asked once the client is ready to draw
    // Requests for the status window and town doors; each answers with a fresh view.
    status: (client: FieldClient) => this.seated(client, (seat) => statusPanel(this.ctx, seat.entityId, this.place(seat))),
    loadout: (client: FieldClient, msg: LoadoutRequest) =>
      this.seated(client, (seat) => changeLoadout(this.ctx, seat.entityId, this.place(seat), msg)),
    gear: (client: FieldClient, msg: GearRequest) => this.seated(client, (seat) => changeGear(this.ctx, seat.entityId, this.place(seat), msg)),
    service: (client: FieldClient, msg: ServiceRequest) =>
      this.seated(client, (seat) => (seat.door && seat.walker.path.length === 0 ? useService(this.ctx, seat.entityId, seat.door, msg) : null)),
  };

  private get ctx() {
    return { world: FieldRoom.world, rng: this.rng, ref: this.ref };
  }

  private seated<T>(client: FieldClient, work: (seat: Seat) => Promise<T> | T | null): Promise<T | null> | T | null {
    const seat = client.userData;
    return seat && !seat.leaving ? work(seat) : null;
  }

  // Swaps happen inside a town's safe square only (the testing flag lifts that).
  private place(seat: Seat) {
    return { inTown: this.kind === 'town' && isSafe(this.grid, seat.walker), inBattle: false };
  }

  async onCreate(options: JoinOptions) {
    this.ref = String(options.ref ?? '');
    const field = await gridFor(FieldRoom.world, this.ref);
    if (!field) throw new Error(`unknown field ${this.ref}`);
    this.grid = field.grid;
    this.kind = field.kind;
    this.view = fieldView(this.ref, field.kind, field.grid);
    this.setTimestep((dt) => this.tick(dt), TICK_MS);
  }

  // Dev join: a name, local only. The player must stand in this field (the DB says where).
  async onAuth(_client: FieldClient, options: JoinOptions) {
    const name = String(options.name ?? '');
    if (!NAME.test(name)) throw new Error('bad_name');
    const placed = await placePlayer(FieldRoom.world, name);
    if (placed.position.fieldRef !== this.ref) throw new Error('wrong_field');
    return placed;
  }

  async onJoin(client: FieldClient, _options: JoinOptions, auth: Awaited<ReturnType<typeof placePlayer>>) {
    for (const other of this.clients) {
      if (other !== client && other.userData?.entityId === auth.entityId) other.leave(); // one seat per player
    }
    const { cfg } = FieldRoom.world.data;
    const { tier, luck } = await walkerStats(FieldRoom.world, auth.entityId);
    // Counts change with kills (and later the world tick): read them fresh when someone arrives.
    this.population = await populationFor(FieldRoom.world, this.ref);
    if (this.kind === 'town') await saveWake(FieldRoom.world.pool, auth.entityId, this.ref); // wakes here after passing out
    const speed = walkSpeed(cfg, tier);
    client.userData = {
      entityId: auth.entityId, name: String(_options.name), walker: newWalker(auth.position), speed, luck,
      grace: cfg.encounter.graceSteps, leaving: false, door: null,
    };
    this.state.players.set(client.sessionId, new FieldPlayer({
      name: client.userData.name, x: auth.position.x, y: auth.position.y, walking: false,
      stepMs: speed > 0 ? Math.round(1000 / speed) : 0,
    }));
  }

  onDrop(client: FieldClient) {
    if (client.userData?.leaving) return; // travelling: the next field's spot is saved, no way back into this room
    this.save(client);
    const p = this.state.players.get(client.sessionId);
    if (p) p.connected = false;
    this.allowReconnection(client, RECONNECT_SECONDS);
  }

  onReconnect(client: FieldClient) {
    const p = this.state.players.get(client.sessionId);
    if (p) p.connected = true;
  }

  onLeave(client: FieldClient) {
    if (!client.userData?.leaving) this.save(client);
    this.state.players.delete(client.sessionId);
  }

  private say(client: FieldClient, key: string) {
    const line: FieldLine = { key, text: FieldRoom.world.data.lines.pick(this.rng, key, 0, 'self')?.text ?? null };
    client.send('line', line);
  }

  private save(client: FieldClient) {
    const seat = client.userData;
    if (!seat) return;
    savePosition(FieldRoom.world.pool, seat.entityId, { fieldRef: this.ref, x: seat.walker.x, y: seat.walker.y })
      .catch((err: Error) => console.error(`save position failed: ${err.message}`));
  }

  private walk(client: FieldClient, msg: WalkRequest) {
    const seat = client.userData;
    if (!seat || seat.leaving) return;
    const x = Math.floor(Number(msg?.x));
    const y = Math.floor(Number(msg?.y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (seat.speed <= 0) return this.say(client, 'field.stuck');
    const path = findPath(this.grid, seat.walker, { x, y }, FieldRoom.world.data.cfg.walk.maxPath);
    if (!path) return this.say(client, 'field.cannot_reach');
    seat.walker.path = path;
    if (path.length > 0) seat.door = null;
    const p = this.state.players.get(client.sessionId);
    if (p) p.walking = path.length > 0;
  }

  private tick(dtMs: number) {
    for (const client of this.clients) {
      const seat = client.userData;
      const p = this.state.players.get(client.sessionId);
      if (!seat || !p || seat.leaving || seat.walker.path.length === 0) continue;
      for (const tile of advance(seat.walker, dtMs / 1000, seat.speed)) {
        p.x = tile.x;
        p.y = tile.y;
        if (this.stepped(client, seat)) break;
      }
      if (seat.walker.path.length > 0 || !p.walking) continue;
      p.walking = false;
      // A walk that ends on an exit leaves the field; passing over one on the way does not.
      const exit = this.grid.exits.find((e) => e.x === seat.walker.x && e.y === seat.walker.y);
      if (!exit || !this.leaveBy(client, exit.id)) this.save(client);
      const door = tileAt(this.grid, seat.walker.x, seat.walker.y)?.service ?? null;
      if (door && !exit) this.openDoor(client, seat, door);
    }
  }

  // Each tile stepped may roll an encounter (party leader's luck; solo players lead themselves).
  // True when creatures jump out: the walk stops there.
  private stepped(client: FieldClient, seat: Seat): boolean {
    if (isSafe(this.grid, seat.walker)) return false; // a town's square never rolls
    if (seat.grace > 0) return void seat.grace--, false;
    const { cfg } = FieldRoom.world.data;
    const foes = rollEncounter(cfg.encounter, cfg.luck, this.population, seat.luck, this.rng);
    if (!foes) return false;
    seat.walker.path = [];
    seat.grace = cfg.encounter.graceSteps;
    seat.leaving = true; // until the battle is set up; reset if it cannot be
    const p = this.state.players.get(client.sessionId);
    if (p) p.walking = false;
    this.save(client);
    void this.startBattle(client, seat, foes);
    return true;
  }

  // Creates the private battle room, reserves the player's seat there, and sends them off.
  private async startBattle(client: FieldClient, seat: Seat, foes: Foe[]) {
    const line = FieldRoom.world.data.lines.pick(this.rng, 'field.encounter', 0, 'self');
    const notice: EncounterNotice = { key: 'field.encounter', text: line?.text ?? null, seat: null };
    try {
      const order: BattleOrder = {
        entityId: seat.entityId, name: seat.name, fieldRef: this.ref, x: seat.walker.x, y: seat.walker.y, foes,
        seed: Math.floor(this.rng() * 2 ** 31),
      };
      const room = await matchMaker.createRoom(BATTLE_ROOM, order);
      notice.seat = await matchMaker.reserveSeatFor(room, {}, { entityId: seat.entityId });
    } catch (err) {
      console.error(`battle setup failed: ${(err as Error).message}`);
      seat.leaving = false;
    }
    client.send('encounter', notice);
    // Like travel: the client leaves first; a consented close, or the SDK would reconnect into this room.
    if (notice.seat) this.clock.setTimeout(() => client.leave(CloseCode.CONSENTED), TRAVEL_GRACE_MS);
  }

  // Stopping on a town door opens its service.
  private openDoor(client: FieldClient, seat: Seat, service: string) {
    seat.door = service;
    openService(this.ctx, seat.entityId, service)
      .then((view) => client.send('service', view))
      .catch((err: Error) => console.error(`service failed: ${err.message}`));
  }

  // Stepping onto an exit: move the player's saved position to the linked field and tell the client to go there.
  private leaveBy(client: FieldClient, exitId: string): boolean {
    const seat = client.userData!;
    const target = linkExit(FieldRoom.world.links, this.ref, exitId);
    if (!target) {
      this.say(client, 'field.no_way');
      return false;
    }
    seat.leaving = true;
    seat.walker.path = [];
    void gridFor(FieldRoom.world, target.ref).then(async (field) => {
      const exit = field?.grid.exits.find((e) => e.id === target.exit);
      const spot = exit ?? field?.grid.spawn ?? { x: seat.walker.x, y: seat.walker.y };
      await savePosition(FieldRoom.world.pool, seat.entityId, { fieldRef: target.ref, x: spot.x, y: spot.y });
      const order: TravelOrder = { ref: target.ref };
      client.send('travel', order);
      // The client should leave first. A consented close, or the SDK would reconnect into this room.
      this.clock.setTimeout(() => client.leave(CloseCode.CONSENTED), TRAVEL_GRACE_MS);
    }).catch((err: Error) => console.error(`travel failed: ${err.message}`));
    return true;
  }
}
