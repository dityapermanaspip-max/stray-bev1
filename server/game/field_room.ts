import { CloseCode, Room, type Client } from '@colyseus/core';
import { savePosition, saveWake } from '../data/position_repo.ts';
import { linkExit } from '../field/links.ts';
import { nodeAt } from '../field/nodes.ts';
import { clearMeal, eat, mealEndsAt } from '../food/food_service.ts';
import { gatherAt, nodeIsDark } from '../gather/gather_service.ts';
import { findPath } from '../field/path.ts';
import { isSafe } from '../field/town.ts';
import { tileAt, type FieldGrid, type FieldKind, type ResourceNode } from '../field/types.ts';
import { advance, newWalker, walkSpeed, type Walker } from '../field/walker.ts';
import { markVisited, mapView } from '../map/map_view.ts';
import { leaveVisit, startVisit } from '../standing/standing_repo.ts';
import { openService, useService } from '../town/doors.ts';
import { isFighting, withEntity } from '../util/entity_lock.ts';
import { createRng } from '../util/rng.ts';
import { rollEncounter, type Foe } from '../world/encounter.ts';
import type { PopRow } from '../world/population.ts';
import type { AskAnswer, EncounterNotice, FieldLine, FieldView, JoinOptions, TravelOrder, WalkRequest } from '../../shared/field.ts';
import { askView, type Pending } from './ask.ts';
import type { EatRequest, GearRequest, LoadoutRequest, ServiceRequest } from '../../shared/town.ts';
import { openBattle, type BattleOrder } from './battle_setup.ts';
import { FieldPlayer, FieldState } from './field_state.ts';
import { changeGear, changeLoadout, statusPanel } from './status_service.ts';
import { fieldView, gridFor, groupCapFor, placePlayer, populationFor, walkerStats, type GameWorld } from './world.ts';

// One room per field (hex or corridor). Shared and cheap: walking only. Encounters hand the player to a
// private battle room and they leave this one; they come back to the same tile when it is over.
// The server finds every path and moves every player; the client only asks "walk to tile".

// grace: steps left before encounters can roll again (after entering the field or an encounter).
// door: the town service of the door the player went into, if any. ask: the yes / no question waiting for an answer.
// mealEnds: when the hidden meal effect runs out (ms), to say so then.
type Seat = {
  entityId: string; name: string; walker: Walker; speed: number; luck: number; grace: number; leaving: boolean; door: string | null; ask: Pending | null;
  mealEnds: number | null;
};
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
    answer: (client: FieldClient, msg: AskAnswer) => this.answer(client, msg),
    view: (): FieldView => this.view, // request: the tile grid, asked once the client is ready to draw
    // Requests for the status window and town doors; each answers with a fresh view.
    status: (client: FieldClient) => this.seated(client, (seat) => statusPanel(this.ctx, seat.entityId, this.place(seat))),
    loadout: (client: FieldClient, msg: LoadoutRequest) =>
      this.seated(client, (seat) => changeLoadout(this.ctx, seat.entityId, this.place(seat), msg)),
    gear: (client: FieldClient, msg: GearRequest) => this.seated(client, (seat) => changeGear(this.ctx, seat.entityId, this.place(seat), msg)),
    eat: (client: FieldClient, msg: EatRequest) => this.seated(client, (seat) => eat(this.ctx, seat.entityId, this.place(seat), String(msg?.ref ?? ''))
      .then((done) => ((seat.mealEnds = done.endsAt ?? seat.mealEnds), done.panel))), // the status window again, with a line
    map: (client: FieldClient) => this.seated(client, (seat) => mapView(FieldRoom.world, seat.entityId, this.ref)), // the world map, fogged
    service: (client: FieldClient, msg: ServiceRequest) =>
      this.seated(client, (seat) => (seat.door && seat.walker.path.length === 0 ? useService(this.ctx, seat.entityId, seat.door, msg) : null)),
  };

  private get ctx() {
    return { world: FieldRoom.world, rng: this.rng, ref: this.ref };
  }

  // One action at a time per player, and none while they fight (in another tab): see util/entity_lock.ts.
  private seated<T>(client: FieldClient, work: (seat: Seat) => Promise<T> | T | null): Promise<T | null> | null {
    const seat = client.userData;
    if (!seat || seat.leaving || isFighting(seat.entityId)) return null;
    return withEntity(seat.entityId, () => (isFighting(seat.entityId) ? null : work(seat)));
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
    if (FieldRoom.world.links.hexes.has(this.ref)) await markVisited(FieldRoom.world.pool, auth.entityId, this.ref); // lifts the fog
    if (this.kind === 'town') {
      await saveWake(FieldRoom.world.pool, auth.entityId, this.ref); // wakes here after passing out
      await startVisit(FieldRoom.world.pool, auth.entityId, this.ref); // a new visit, unless they never left
    }
    const speed = walkSpeed(cfg, tier);
    client.userData = {
      entityId: auth.entityId, name: String(_options.name), walker: newWalker(auth.position), speed, luck,
      grace: cfg.encounter.graceSteps, leaving: false, door: null, ask: null, mealEnds: await mealEndsAt(FieldRoom.world, auth.entityId),
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
    if (!seat || seat.leaving || isFighting(seat.entityId)) return;
    const x = Math.floor(Number(msg?.x)), y = Math.floor(Number(msg?.y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (seat.speed <= 0) return this.say(client, 'field.stuck');
    const path = findPath(this.grid, seat.walker, { x, y }, FieldRoom.world.data.cfg.walk.maxPath);
    if (!path) return this.say(client, 'field.cannot_reach');
    seat.walker.path = path;
    if (path.length > 0) seat.door = seat.ask = null;
    const p = this.state.players.get(client.sessionId);
    if (p) p.walking = path.length > 0;
  }

  private tick(dtMs: number) {
    for (const client of this.clients) {
      const seat = client.userData;
      const p = this.state.players.get(client.sessionId);
      if (seat?.mealEnds && Date.now() >= seat.mealEnds) this.mealOver(client, seat);
      if (!seat || !p || seat.leaving || seat.walker.path.length === 0) continue;
      for (const tile of advance(seat.walker, dtMs / 1000, seat.speed)) {
        p.x = tile.x;
        p.y = tile.y;
        if (this.stepped(client, seat)) break;
      }
      if (seat.walker.path.length > 0 || !p.walking) continue;
      p.walking = false;
      // Passing over an exit on the way does nothing; only where a walk ends counts.
      // A walk that ends on a door or an exit asks first (see answer).
      this.save(client);
      const exit = this.exitHere(seat);
      const door = tileAt(this.grid, seat.walker.x, seat.walker.y)?.service ?? null;
      if (exit && !linkExit(FieldRoom.world.links, this.ref, exit)) this.say(client, 'field.no_way');
      else if (exit) this.askFirst(client, seat, { kind: 'exit', exitId: exit });
      else if (door) this.askFirst(client, seat, { kind: 'door', service: door });
      const node = nodeAt(this.grid, seat.walker.x, seat.walker.y);
      if (node) this.askFirst(client, seat, { kind: 'node', node: node.id, nodeKind: node.kind, dark: nodeIsDark(node, this.population) });
    }
  }

  private mealOver(client: FieldClient, seat: Seat) {
    seat.mealEnds = null;
    this.say(client, 'food.end');
    clearMeal(FieldRoom.world.pool, seat.entityId).catch((err: Error) => console.error(`meal clear failed: ${err.message}`));
  }

  // Each tile stepped may roll an encounter (party leader's luck; solo players lead themselves).
  // True when creatures jump out: the walk stops there.
  private stepped(client: FieldClient, seat: Seat): boolean {
    if (isSafe(this.grid, seat.walker)) return false; // a town's square never rolls
    if (isFighting(seat.entityId)) return false; // already in a battle (another tab)
    if (seat.grace > 0) return void seat.grace--, false;
    const { cfg } = FieldRoom.world.data;
    const foes = rollEncounter(cfg.encounter, cfg.luck, this.population, seat.luck, this.rng, groupCapFor(FieldRoom.world, this.ref));
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

  // Hands the player to a private battle room (battle_setup.ts) and sends them off.
  private async startBattle(client: FieldClient, seat: Seat, foes: Foe[]) {
    const line = FieldRoom.world.data.lines.pick(this.rng, 'field.encounter', 0, 'self');
    const order: BattleOrder = {
      entityId: seat.entityId, name: seat.name, fieldRef: this.ref, x: seat.walker.x, y: seat.walker.y, foes, seed: Math.floor(this.rng() * 2 ** 31),
    };
    const notice: EncounterNotice = { key: 'field.encounter', text: line?.text ?? null, seat: await openBattle(order) };
    if (!notice.seat) seat.leaving = false;
    client.send('encounter', notice); // like travel: the client leaves first, then a consented close
    if (notice.seat) this.clock.setTimeout(() => client.leave(CloseCode.CONSENTED), TRAVEL_GRACE_MS);
  }

  private exitHere(seat: Seat): string | null {
    return this.grid.exits.find((e) => e.x === seat.walker.x && e.y === seat.walker.y)?.id ?? null;
  }

  private askFirst(client: FieldClient, seat: Seat, pending: Pending) {
    seat.ask = pending;
    client.send('ask', askView(FieldRoom.world, this.rng, pending));
  }

  // Yes to the waiting question, while still standing where it was asked: open the door or leave. No does nothing.
  private answer(client: FieldClient, msg: AskAnswer) {
    const seat = client.userData;
    const pending = seat?.ask;
    if (!seat || !pending) return;
    seat.ask = null;
    if (msg?.yes !== true || seat.leaving || seat.walker.path.length > 0 || isFighting(seat.entityId)) return;
    if (pending.kind === 'door' && tileAt(this.grid, seat.walker.x, seat.walker.y)?.service === pending.service) this.openDoor(client, seat, pending.service);
    if (pending.kind === 'exit' && this.exitHere(seat) === pending.exitId && !this.leaveBy(client, pending.exitId)) this.save(client);
    const node = nodeAt(this.grid, seat.walker.x, seat.walker.y);
    if (pending.kind === 'node' && node?.id === pending.node) void this.gather(client, seat, node);
  }

  // Working a node (gather_service.ts). A guarded dark node may end in an ambush.
  private async gather(client: FieldClient, seat: Seat, node: ResourceNode) {
    const done = await this.seated(client, () => gatherAt(this.ctx, seat.entityId, node, this.population, groupCapFor(FieldRoom.world, this.ref)))
      ?.catch((err: Error) => void console.error(`gather failed: ${err.message}`));
    if (!done) return;
    client.send('gathered', done.notice);
    if (!done.foes || seat.leaving || seat.walker.path.length > 0) return;
    seat.leaving = true;
    void this.startBattle(client, seat, done.foes);
  }

  // Going in at a town door opens its service.
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
      if (this.kind === 'town') await leaveVisit(FieldRoom.world.pool, seat.entityId, this.ref);
      const order: TravelOrder = { ref: target.ref };
      client.send('travel', order);
      // The client should leave first. A consented close, or the SDK would reconnect into this room.
      this.clock.setTimeout(() => client.leave(CloseCode.CONSENTED), TRAVEL_GRACE_MS);
    }).catch((err: Error) => console.error(`travel failed: ${err.message}`));
    return true;
  }
}
