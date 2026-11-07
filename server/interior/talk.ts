import { FAVOR_NAME_PREFIX, TALK_OPT_PREFIX } from '../db/startup_check.ts';
import { loadInventory } from '../data/item_repo.ts';
import type { GameWorld } from '../game/world.ts';
import { countOf } from '../inventory/bag.ts';
import { ITEM_NAME_PREFIX } from '../inventory/bag_view.ts';
import { unlocked } from '../recruit/companion_rules.ts';
import { bearingOf, dismissNpc, giftNpc, hireNpc, payNpc, recruitNpc, talkNpc, type Reply } from '../recruit/companions.ts';
import { shopRefused, shopTalk } from '../standing/shop_standing.ts';
import type { Rng } from '../util/rng.ts';
import type { TalkAct, TalkRequest, TalkView } from '../../shared/talk.ts';
import type { Placed } from './npc_place.ts';

// The talk menu of an NPC and what each choice does. Choices appear by favor tier (config standing.ladder.unlocks);
// the bond shows as the tier's word. trade and rest open the door's panel (the room does that: `door`).

export type TalkOut = { view: TalkView; door: string | null };

export type TalkCtx = { world: GameWorld; rng: Rng; playerId: string; townRef: string };
const line = (c: TalkCtx, key: string) => c.world.data.lines.pick(c.rng, key, 0, 'self')?.text ?? null;

// A craftsman's keeper opens the recipes of their facility (the same panel as the town door).
const isCraft = (c: TalkCtx, role: string) => c.world.recipes.some((r) => r.facility === role);

export async function talkView(c: TalkCtx, npc: Placed, text: string | null): Promise<TalkView> {
  const { cfg } = c.world.data;
  const l = cfg.standing.ladder;
  const b = await bearingOf(c.world, c.rng, c.playerId, npc.entity);
  const refused = npc.role === 'shop' && shopRefused(cfg.standing, await shopTalk(c.world, c.playerId, c.townRef, c.rng));
  const acts: { act: TalkAct; price: number | null }[] = [{ act: 'talk', price: null }];
  if ((npc.role === 'shop' && !refused) || isCraft(c, npc.role)) acts.push({ act: 'trade', price: null });
  if (npc.role === 'inn') acts.push({ act: 'rest', price: cfg.town.innPrice });
  const gifts = b && unlocked(l, 'gift', b.tier) ? await giftable(c) : [];
  if (gifts.length > 0) acts.push({ act: 'gift', price: null });
  if (b && !b.inParty) {
    if (b.wage !== null) acts.push({ act: 'hire', price: b.wage * l.hireDays });
    else if (npc.role === 'recruit' || npc.role === 'summoner') acts.push({ act: 'recruit', price: null });
  }
  if (b?.mine) {
    if (b.wage !== null) acts.push({ act: 'pay', price: b.wage * l.hireDays });
    acts.push({ act: 'dismiss', price: null });
  }
  return {
    name: npc.name,
    bond: b ? line(c, FAVOR_NAME_PREFIX + b.tier) : null,
    text: text ?? line(c, 'npc.greet'),
    options: acts.map((a) => ({ ...a, label: line(c, TALK_OPT_PREFIX + a.act) ?? a.act })),
    gifts,
  };
}

// What the bag could give: single items by name (keys never).
async function giftable(c: TalkCtx): Promise<TalkView['gifts']> {
  const inv = await loadInventory(c.world.pool, c.playerId);
  const items = [...new Set([...inv.stacks.values()].map((s) => s.item))].filter((i) => c.world.catalog.get(i)?.type !== 'key');
  return items.map((item) => ({ item, name: line(c, ITEM_NAME_PREFIX + item) ?? item, qty: countOf(inv, item) }));
}

export async function talkAct(c: TalkCtx, npc: Placed, req: TalkRequest): Promise<TalkOut> {
  const { world, rng, playerId } = c;
  let reply: Reply = { line: null, ok: true };
  let door: string | null = null;
  switch (req?.act) {
    case 'talk': reply = await talkNpc(world, rng, playerId, npc.entity); break;
    case 'gift': reply = await giftNpc(world, rng, playerId, npc.entity, String(req.item ?? '')); break;
    case 'hire': reply = await hireNpc(world, rng, playerId, npc.entity); break;
    case 'recruit': reply = await recruitNpc(world, rng, playerId, npc.entity); break;
    case 'pay': reply = await payNpc(world, rng, playerId, npc.entity); break;
    case 'dismiss': reply = await dismissNpc(world, rng, playerId, npc.entity); break;
    case 'trade': door = npc.role === 'shop' || isCraft(c, npc.role) ? npc.role : null; break;
    case 'rest': door = npc.role === 'inn' ? 'inn' : null; break;
    default: break;
  }
  return { view: await talkView(c, npc, reply.line), door };
}
