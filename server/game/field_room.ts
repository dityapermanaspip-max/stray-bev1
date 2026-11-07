import { Room } from '@colyseus/core';
import { savePosition, saveWake } from '../data/position_repo.ts';
import { exitTiles } from '../field/exits.ts';
import { hexOf, linkExit } from '../field/links.ts';
import { nodeBeside, walkPlan } from '../field/nodes.ts';
import { clearMeal, mealEndsAt } from '../food/food_service.ts';
import { gatherAt, nodeIsDark } from '../gather/gather_service.ts';
import { isSafe } from '../field/town.ts';
import { tileAt, type FieldGrid, type FieldKind, type ResourceNode } from '../field/types.ts';
import { advance, newWalker, walkSpeed } from '../field/walker.ts';
import { baseRef } from '../interior/interior_ref.ts';
import { RoomDesk } from '../interior/desk.ts';
import { markVisited, mapView } from '../map/map_view.ts';
import { startVisit } from '../standing/standing_repo.ts';
import { openService, useService } from '../town/doors.ts';
import { isFighting, withEntity } from '../util/entity_lock.ts';
import { createRng } from '../util/rng.ts';
import { rollEncounter } from '../world/encounter.ts';
import { withVice } from '../vice/vice_finder.ts';
import type { PopRow } from '../world/population.ts';
import type { AskAnswer, FieldLine, FieldView, JoinOptions, WalkRequest } from '../../shared/field.ts';
import type { TalkRequest } from '../../shared/talk.ts';
import { askView, type Pending } from './ask.ts';
import type { ServiceRequest } from '../../shared/town.ts';
import { leaveBy, sendTo, startBattle } from './field_depart.ts';
import { FieldPlayer, FieldState, type FieldClient, type Seat } from './field_state.ts';
import { statusMessages } from './status_messages.ts';
import { fieldView, gridFor, groupCapFor, placePlayer, populationFor, walkerStats, type GameWorld } from './world.ts';

// One room per field (hex or corridor). Shared and cheap: walking only. Encounters hand the player to a
// private battle room and they leave this one; they come back to the same tile when it is over.
// The server finds every path and moves every player; the client only asks "walk to tile".

const TICK_MS = 50;
const RECONNECT_SECONDS = 20;
const NAME = /^[A-Za-z0-9_]{2,24}$/;

export class FieldRoom extends Room<{ state: FieldState; client: FieldClient }> {
  static world: GameWorld; // set once by the game server before it listens
  state = new FieldState();
  ref = ''; kind: FieldKind = 'open'; // read by field_depart.ts too
  private grid!: FieldGrid;
  private view!: FieldView;
  private population: PopRow[] = []; // hidden counts; towns have none (safe)
  rng = createRng(Date.now() >>> 0);
  private desk!: RoomDesk; // people and doors of rooms inside fields (interior/desk.ts)

  messages = {
    walk: (client: FieldClient, msg: WalkRequest) => this.walk(client, msg),
    answer: (client: FieldClient, msg: AskAnswer) => this.answer(client, msg),
    view: (): FieldView => this.view, // request: the tile grid, asked once the client is ready to draw
    ...statusMessages((client, work) => this.seated(client, work), () => this.ctx, (seat) => this.place(seat)), // status window requests
    map: (client: FieldClient) => this.seated(client, (seat) => mapView(FieldRoom.world, seat.entityId, baseRef(this.ref))), // the world map, fogged
    service: (client: FieldClient, msg: ServiceRequest) =>
      this.seated(client, (seat) => (seat.door && seat.walker.path.length === 0 ? useService({ ...this.ctx, rested: () => this.rested(client, seat) }, seat.entityId, seat.door, msg) : null)),
    talk_act: (client: FieldClient, msg: TalkRequest) => this.seated(client, (seat) => this.talking(client, seat, msg)),
  };

  get world() { return FieldRoom.world; }
  private get ctx() { return { world: FieldRoom.world, rng: this.rng, ref: baseRef(this.ref) }; } // a room's shop is its town's

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
    this.desk = new RoomDesk(FieldRoom.world, this.ref);
    ({ grid: this.grid, view: this.view } = await this.desk.refresh(this.rng, field.grid, fieldView(this.ref, field.kind, field.grid, FieldRoom.world.data.cfg.blend.rank)));
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
    this.population = await populationFor(FieldRoom.world, baseRef(this.ref));
    const hex = hexOf(FieldRoom.world.links, baseRef(this.ref));
    if (hex) await markVisited(FieldRoom.world.pool, auth.entityId, hex); // lifts the fog (a town counts for its hex)
    if (this.kind === 'town') {
      await saveWake(FieldRoom.world.pool, auth.entityId, this.ref); // wakes here after passing out
      await startVisit(FieldRoom.world.pool, auth.entityId, this.ref); // a new visit, unless they never left
    }
    const speed = walkSpeed(cfg, tier);
    client.userData = {
      entityId: auth.entityId, name: String(_options.name), walker: newWalker(auth.position), speed, luck,
      grace: cfg.encounter.graceSteps, leaving: false, door: null, ask: null, aim: null, talk: null, mealEnds: await mealEndsAt(FieldRoom.world, auth.entityId),
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

  say(client: FieldClient, key: string) {
    const line: FieldLine = { key, text: FieldRoom.world.data.lines.pick(this.rng, key, 0, 'self')?.text ?? null };
    client.send('line', line);
  }

  save(client: FieldClient) {
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
    const { path, node } = walkPlan(this.grid, seat.walker, { x, y }, FieldRoom.world.data.cfg.walk.maxPath);
    if (!path) return this.say(client, 'field.cannot_reach');
    [seat.walker.path, seat.aim] = [path, node?.id ?? null]; // a node is an obstacle: the walk ends beside it
    if (path.length > 0) seat.door = seat.ask = seat.talk = null;
    else if (node) this.askNode(client, seat); // already beside it: ask again at once
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
      this.askNode(client, seat);
    }
  }

  // Standing beside the node the walk headed for: ask before working it.
  private askNode(client: FieldClient, seat: Seat) {
    const node = seat.aim === null ? null : nodeBeside(this.grid, seat.walker, seat.aim);
    if (node && this.desk.isNpc(node)) return this.talkTo(client, seat, node.id);
    const use = node && this.desk.useOf(node);
    if (use) return this.useProp(client, seat, use);
    if (node) this.askFirst(client, seat, { kind: 'node', node: node.id, nodeKind: node.kind, dark: nodeIsDark(node, this.population) });
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
    const met = rollEncounter(cfg.encounter, cfg.luck, this.population, seat.luck, this.rng, groupCapFor(FieldRoom.world, this.ref));
    const foes = withVice(this.ref, met, cfg.vice.findPermille, this.rng); // now and then, the vice of this hex itself
    if (!foes) return false;
    seat.walker.path = [];
    seat.grace = cfg.encounter.graceSteps;
    seat.leaving = true; // until the battle is set up; reset if it cannot be
    const p = this.state.players.get(client.sessionId);
    if (p) p.walking = false;
    this.save(client);
    void startBattle(this, client, seat, foes);
    return true;
  }

  private exitHere(seat: Seat): string | null {
    const { width, height } = this.grid;
    return exitTiles(this.grid.exits, width, height, this.kind).find((e) => e.x === seat.walker.x && e.y === seat.walker.y)?.id ?? null;
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
    if (pending.kind === 'exit' && this.exitHere(seat) === pending.exitId && !leaveBy(this, client, pending.exitId)) this.save(client);
    const node = pending.kind === 'node' ? nodeBeside(this.grid, seat.walker, pending.node) : null;
    if (node) void this.gather(client, seat, node);
  }

  // Working a node (gather_service.ts). A guarded dark node may end in an ambush.
  private async gather(client: FieldClient, seat: Seat, node: ResourceNode) {
    const into = this.desk.nodeTarget(node); // a camp or cave: go in
    if (into) return sendTo(this, client, seat, into, null);
    const done = await this.seated(client, () => gatherAt(this.ctx, seat.entityId, node, this.population, groupCapFor(FieldRoom.world, this.ref)))
      ?.catch((err: Error) => void console.error(`gather failed: ${err.message}`));
    if (!done) return;
    client.send('gathered', done.notice);
    if (!done.foes || seat.leaving || seat.walker.path.length > 0) return;
    seat.leaving = true;
    void startBattle(this, client, seat, done.foes);
  }

  // Going in at a town door opens its service.
  private openDoor(client: FieldClient, seat: Seat, service: string) {
    const into = this.desk.doorTarget(service); // a shop, inn or training ground: go in
    if (into) return sendTo(this, client, seat, into, null);
    seat.door = service;
    openService(this.ctx, seat.entityId, service)
      .then((view) => client.send('service', view))
      .catch((err: Error) => console.error(`service failed: ${err.message}`));
  }

  // Beside a bed or a campfire: its service opens (sleep, cook) without going anywhere.
  private useProp(client: FieldClient, seat: Seat, service: string) {
    seat.door = service;
    openService(this.ctx, seat.entityId, service)
      .then((view) => client.send('service', view))
      .catch((err: Error) => console.error(`service failed: ${err.message}`));
  }

  // Beside an NPC: the talk opens. What is said and done there is interior/desk.ts and talk.ts.
  private talkTo(client: FieldClient, seat: Seat, id: number) {
    seat.talk = id;
    void this.desk.open(this.rng, seat.entityId, id)?.then((v) => client.send('talk', v))
      .catch((err: Error) => console.error(`talk failed: ${err.message}`)); // a failed talk must never take the server down
  }

  private async talking(client: FieldClient, seat: Seat, req: TalkRequest) {
    const id = seat.talk;
    if (id === null || seat.walker.path.length > 0 || !nodeBeside(this.grid, seat.walker, id)) return null;
    const out = await this.desk.act(this.rng, seat.entityId, id, req);
    if (!out) return null;
    if (out.door) {
      seat.door = out.door;
      void openService(this.ctx, seat.entityId, out.door).then((v) => client.send('service', v));
    }
    return out.view;
  }

  // A rest at a camp or cave may bring creatures.
  private rested(client: FieldClient, seat: Seat) {
    const room = this.desk.room;
    const foes = room && this.desk.ambush(room.kind, this.population, seat.luck, this.rng, groupCapFor(FieldRoom.world, room.parent));
    if (!foes || seat.leaving) return;
    seat.leaving = true;
    void startBattle(this, client, seat, foes);
  }
}
