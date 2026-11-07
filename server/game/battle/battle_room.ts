import { Room, type Client } from '@colyseus/core';
import { createBattleRow, snapshotBattle } from '../../data/battle_repo.ts';
import { withEntity } from '../../util/entity_lock.ts';
import { createRng } from '../../util/rng.ts';
import { unlocked } from '../../recruit/companion_rules.ts';
import { bearingOf } from '../../recruit/companions.ts';
import type { BattleEntity } from '../../battle/types.ts';
import type { GearRequest } from '../../../shared/town.ts';
import type { ActRequest, AutoRequest, BattleLine, BattleView, SetTargetRequest } from '../../../shared/battle.ts';
import { gearView, swapGear } from './battle_gear.ts';
import { finishFight } from './battle_end.ts';
import { fightState, releaseFight, setUpFight, type BattleOrder, type Fight } from './battle_setup.ts';
import { battleView, eventsFor, isReady, type Words } from './battle_view.ts';
import type { GameWorld } from '../world.ts';

// One private battle per encounter. Created by the field room with a seat reserved for the player;
// the room clock drives the battle and the client only sends "use this move on that target".
// While the player is away (not joined yet, dropped, left), the battle AI fights for them.

type BattleClient = Client<{ userData: { entityId: string } }>;

const TICK_MS = 50;
const JOIN_WAIT_MS = 15_000; // the fight starts without the player after this
const SNAPSHOT_MS = 5_000;
const RECONNECT_SECONDS = 20;
const CLOSE_AFTER_MS = 60_000; // after the result, time to read it before the room closes

export class BattleRoom extends Room<{ client: BattleClient }> {
  static world: GameWorld; // set once by the game server before it listens
  maxClients = 1;
  autoDispose = false; // closed by the room itself once the battle is saved
  seatReservationTimeout = JOIN_WAIT_MS / 1000; // the seat waits as long as the fight does
  private fight!: Fight;
  private battleId = '';
  private words!: Words;
  private rng = createRng(Date.now() >>> 0);
  private started = false;
  private ended = false;
  private wasReady = false;
  private order = '';
  private sinceSnapshot = 0;

  messages = {
    view: (): BattleView => battleView(this.words, this.fight, BattleRoom.world.data.cfg.loadoutSlots, BattleRoom.world.data.cfg.formation),
    act: (client: BattleClient, msg: ActRequest) => this.act(client, msg),
    auto: (client: BattleClient, msg: AutoRequest) => this.auto(client, msg),
    set_target: (client: BattleClient, msg: SetTargetRequest) => this.setTarget(client, msg),
    flee: (client: BattleClient) => this.flee(client),
    gear_view: (client: BattleClient) => client.send('gear_view', gearView(BattleRoom.world, this.rng, this.fight)),
    gear: (client: BattleClient, msg: GearRequest) => this.gear(client, msg),
  };

  async onCreate(order: BattleOrder) {
    const world = BattleRoom.world;
    this.fight = await withEntity(order.entityId, () => setUpFight(world, order)); // after any pending field action
    this.words = { lines: world.data.lines, rng: this.rng, moves: world.data.moves, figures: { vice: world.data.cfg.vice.figures, boss: world.data.cfg.boss.figure } };
    this.battleId = await createBattleRow(world.pool, world.roundId, fightState(this.fight));
    await this.snapshot();
    this.setSimulationInterval((dt) => this.tick(dt), TICK_MS);
    this.clock.setTimeout(() => this.start('ai'), JOIN_WAIT_MS);
  }

  // Never leave a player marked as fighting, even if the room goes away without an end.
  onDispose() {
    if (this.fight) releaseFight(this.fight.order);
  }

  // Only the seat the field room reserved can join; its auth data names the player.
  onJoin(client: BattleClient, _options: unknown, auth?: { entityId?: string }) {
    if (auth?.entityId !== this.fight.order.entityId) throw new Error('not_your_battle');
    client.userData = { entityId: auth.entityId };
    this.control('player');
    this.start('player');
  }

  onDrop(client: BattleClient) {
    if (this.ended) return;
    this.control('ai');
    this.allowReconnection(client, RECONNECT_SECONDS);
  }

  onReconnect() {
    this.control('player');
  }

  onLeave() {
    if (this.ended) return void this.disconnect();
    this.control('ai');
  }

  private start(who: 'ai' | 'player') {
    if (this.started) return;
    this.started = true;
    this.control(who);
  }

  private control(who: 'ai' | 'player') {
    if (!this.ended) this.fight.player.controller = who;
  }

  // Who acts for this request: the player, or one commanded companion (tier command, config): the player
  // steers them live. Anything else names their own battle only.
  private async actorOf(playerId: string, id: string | null | undefined): Promise<BattleEntity | null> {
    const f = this.fight;
    if (!id || id === f.player.id) return f.player;
    const c = f.companions.find((x) => x.entity.id === id);
    if (!c) return null;
    const b = await bearingOf(BattleRoom.world, this.rng, playerId, id);
    if (!b || !b.mine || !unlocked(BattleRoom.world.data.cfg.standing.ladder, 'command', b.tier)) return null;
    return c.entity;
  }

  private canNotAct(client: BattleClient) {
    const line: BattleLine = { key: 'battle.cannot', text: BattleRoom.world.data.lines.pick(this.rng, 'battle.cannot', 0, 'self')?.text ?? null };
    client.send('line', line);
  }

  private async act(client: BattleClient, msg: ActRequest) {
    if (this.ended || client.userData?.entityId !== this.fight.player.id) return;
    const actor = await this.actorOf(client.userData.entityId, msg?.id);
    if (!actor) return void this.canNotAct(client);
    const error = this.fight.instance.submit(actor.id, String(msg?.move ?? ''), msg?.target ? String(msg.target) : '');
    if (!error) return;
    this.canNotAct(client);
  }

  // The whole party runs on one roll (battle/flee.ts). A refusal or a failed try answers with a line.
  private flee(client: BattleClient) {
    if (this.ended || client.userData?.entityId !== this.fight.player.id) return;
    const out = this.fight.instance.flee(this.fight.player.id);
    if (out === 'fled') return void this.end();
    const key = out === 'boss' ? 'battle.flee.boss' : out === 'failed' ? 'battle.flee.fail' : 'battle.cannot';
    const line: BattleLine = { key, text: BattleRoom.world.data.lines.pick(this.rng, key, 0, 'self')?.text ?? null };
    client.send('line', line);
  }

  // The menu's gear swap: hands only, costs the turn (a full gauge). Answers the fresh list, or a refusal line.
  private gear(client: BattleClient, msg: GearRequest) {
    if (this.ended || client.userData?.entityId !== this.fight.player.id) return;
    const done = this.fight.instance.restock(this.fight.player.id, () => swapGear(BattleRoom.world, this.fight, msg));
    if (done) return void client.send('gear_view', gearView(BattleRoom.world, this.rng, this.fight));
    this.canNotAct(client);
  }

  private async setTarget(client: BattleClient, msg: SetTargetRequest) {
    if (this.ended || client.userData?.entityId !== this.fight.player.id) return;
    const actor = await this.actorOf(client.userData.entityId, msg?.id);
    if (actor) this.fight.instance.setTarget(actor.id, String(msg?.target ?? ''));
  }

  // auto on=true hands a fighter to the dice, on=false takes them back for the player's own commands.
  private async auto(client: BattleClient, msg: AutoRequest) {
    if (this.ended || client.userData?.entityId !== this.fight.player.id) return;
    const actor = await this.actorOf(client.userData.entityId, msg?.id);
    if (!actor) return;
    actor.controller = msg?.on === true ? 'ai' : 'player';
    if (actor === this.fight.player) return; // the player's join/drop lifecycle keeps setting it above
  }

  private tick(dtMs: number) {
    if (!this.started || this.ended) return;
    const events = eventsFor(this.words, this.fight, this.fight.instance.tick(dtMs));
    const ready = isReady(this.fight) && this.fight.player.controller === 'player';
    if (ready && !this.wasReady) events.push({ type: 'ready' });
    this.wasReady = ready;
    const order = this.fight.instance.turnOrder();
    if (order.join() !== this.order) {
      this.order = order.join();
      events.push({ type: 'order', ids: order });
    }
    if (events.length > 0) this.broadcast('events', events);
    if (this.fight.instance.winner || this.fight.instance.fled) return void this.end();
    this.sinceSnapshot += dtMs;
    if (this.sinceSnapshot >= SNAPSHOT_MS) {
      this.sinceSnapshot = 0;
      void this.snapshot();
    }
  }

  private snapshot(): Promise<void> {
    const rows = [this.fight.player, ...this.fight.companions.map((c) => c.entity)].map((e) => ({
      entityId: e.id, atb: e.atb, hp: e.hp, stamina: e.stamina, mana: e.mana, slot: e.slot, downed: e.hp <= 0,
    }));
    return snapshotBattle(BattleRoom.world.pool, this.battleId, fightState(this.fight), rows)
      .catch((err: Error) => console.error(`battle snapshot failed: ${err.message}`));
  }

  private async end() {
    this.ended = true;
    try {
      const result = await withEntity(this.fight.order.entityId, () => finishFight({ world: BattleRoom.world, rng: this.rng }, this.fight, this.battleId));
      this.broadcast('result', result);
    } catch (err) {
      console.error(`battle save failed: ${(err as Error).message}`);
      this.broadcast('result', { won: this.fight.instance.winner === this.fight.player.side, fled: this.fight.instance.fled, lines: [], taken: [] });
    }
    releaseFight(this.fight.order);
    if (this.clients.length === 0) return void this.disconnect();
    this.clock.setTimeout(() => this.disconnect(), CLOSE_AFTER_MS);
  }
}
