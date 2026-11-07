import { hasTraitFlag } from '../growth/traits.ts';
import { loadEntityState } from '../data/entity_load.ts';
import { markMovesSeen, saveGear, saveLoadout, saveSlot } from '../data/entity_save.ts';
import { loadInventory } from '../data/item_repo.ts';
import { removePiece, removeStack, stackKey } from '../inventory/bag.ts';
import { equipGear, equipLineKey, unequipGear, unequipLineKey, type GearRef } from '../inventory/gear.ts';
import { canSwap, equip, unequip, type SwapPlace } from '../loadout/loadout.ts';
import { isSlot } from '../battle/formation.ts';
import { unlocked } from '../recruit/companion_rules.ts';
import { bearingOf, changeSeat } from '../recruit/companions.ts';
import { buildStatusView } from '../status/status_view.ts';
import type { Rng } from '../util/rng.ts';
import type { DropRequest, FormationRequest, GearRequest, LoadoutRequest, StatusPanel } from '../../shared/town.ts';
import type { GameWorld } from './world.ts';

// The status window from the field: body words, moves and slots, the bag. Loadout and gear changes are
// allowed only inside a town's safe square (or with the testing flag), never in battle.

type Ctx = { world: GameWorld; rng: Rng };

const say = (c: Ctx, key: string) => c.world.data.lines.pick(c.rng, key, 0, 'self')?.text ?? null;
// Refusal code to its sentence pool (all listed in REFUSAL_LINE_KEYS, checked at startup).
const refusal = (kind: 'loadout' | 'gear' | 'formation', error: string) =>
  error === 'not_in_town' ? 'loadout.not_here' : error === 'in_battle' ? 'loadout.in_battle' : `${kind}.${error}`;

// Who a write edits: the player, or one companion of theirs once the bond reaches config standing.ladder.unlocks.loadout's tier.
// Null when the bond is too thin to touch them (or no such companion of this player exists).
async function editTarget(c: Ctx, playerId: string, id: string | null | undefined): Promise<string | null> {
  if (!id || id === playerId) return playerId;
  const b = await bearingOf(c.world, c.rng, playerId, id);
  return b && b.mine && unlocked(c.world.data.cfg.standing.ladder, 'loadout', b.tier) ? id : null;
}

// own: the player's own window (moves seen are marked); else a companion's, read only, with their name in `who`.
export async function statusPanel(c: Ctx, entityId: string, place: SwapPlace, line: string | null = null, own = true): Promise<StatusPanel> {
  const { cfg, lines } = c.world.data;
  const [state, inventory] = await Promise.all([loadEntityState(c.world.pool, entityId), loadInventory(c.world.pool, entityId)]);
  const view = buildStatusView({
    cfg, lines, rng: c.rng, speaker: 'self', progress: state.progress, loadout: state.loadout, body: state.body, unseen: state.unseen,
    bag: { catalog: c.world.catalog, inventory },
  });
  if (own) await markMovesSeen(c.world.pool, entityId);
  const { front, back } = cfg.formation;
  return { ...view, formation: { slot: state.slot, front, back }, canSwap: own && canSwap(cfg, place) === null, line, who: own ? null : state.name };
}

export async function changeLoadout(c: Ctx, playerId: string, place: SwapPlace, req: LoadoutRequest): Promise<StatusPanel | null> {
  const { cfg, moves } = c.world.data;
  const entityId = await editTarget(c, playerId, req?.id);
  if (!entityId) return null;
  const state = await loadEntityState(c.world.pool, entityId);
  const slot = Math.floor(Number(req?.slot));
  const error = req?.move ? equip(cfg, state.loadout, state.progress, moves, slot, String(req.move), place) : unequip(cfg, state.loadout, slot, place);
  if (error) return statusPanel(c, entityId, place, say(c, refusal('loadout', error)));
  await saveLoadout(c.world.pool, entityId, state.loadout);
  return statusPanel(c, entityId, place);
}

export async function changeGear(c: Ctx, playerId: string, place: SwapPlace, req: GearRequest): Promise<StatusPanel | null> {
  const { cfg } = c.world.data;
  const entityId = await editTarget(c, playerId, req?.id);
  if (!entityId) return null;
  const [state, inv] = await Promise.all([loadEntityState(c.world.pool, entityId), loadInventory(c.world.pool, entityId)]);
  let change;
  if (req && 'remove' in req) {
    change = unequipGear(cfg, inv, String(req.remove), place);
  } else {
    const ref = String(req?.wear ?? '');
    const gearRef: GearRef = inv.pieces.some((p) => p.id === ref) ? { piece: ref } : { stack: ref };
    change = equipGear(cfg, c.world.catalog, inv, state.progress, gearRef, place, req?.slot ? String(req.slot) : null,
      hasTraitFlag(state.traits, 'dual_wield'));
  }
  if (typeof change === 'string') return statusPanel(c, entityId, place, say(c, refusal('gear', change)));
  await saveGear(c.world.pool, entityId, inv, state.progress);
  const key = req && 'remove' in req ? unequipLineKey(change.kind) : equipLineKey(change.kind);
  return statusPanel(c, entityId, place, say(c, change.learned ? 'epiphany_weapon' : key));
}

// Picks a battle place: the player's own slot (chosen in town). For a companion it is their place in the party,
// the order they fill the free battle seats in — written to social.party_members (companion_rules plain functions).
export async function changeSlot(c: Ctx, playerId: string, place: SwapPlace, req: FormationRequest): Promise<StatusPanel | null> {
  const { cfg } = c.world.data;
  const entityId = await editTarget(c, playerId, req?.id);
  if (!entityId) return null;
  const slot = Math.floor(Number(req?.slot));
  if (entityId !== playerId) {
    return (await changeSeat(c.world, playerId, entityId, slot))
      ? statusPanel(c, entityId, place)
      : statusPanel(c, entityId, place, say(c, refusal('formation', 'bad_slot')));
  }
  const error = canSwap(cfg, place) ?? (isSlot(cfg.formation, slot) ? null : 'bad_slot');
  if (error) return statusPanel(c, entityId, place, say(c, refusal('formation', error)));
  await saveSlot(c.world.pool, entityId, slot);
  return statusPanel(c, entityId, place);
}

// Throws away part of a stack or one piece. Worn things stay (take them off first); keys are bound and stay.
export async function dropItem(c: Ctx, entityId: string, place: SwapPlace, req: DropRequest): Promise<StatusPanel> {
  const [state, inv] = await Promise.all([loadEntityState(c.world.pool, entityId), loadInventory(c.world.pool, entityId)]);
  const ref = String(req?.ref ?? '');
  const piece = inv.pieces.find((p) => p.id === ref);
  const stack = inv.stacks.get(ref);
  const held = piece ?? stack;
  const refuse = (key: string) => statusPanel(c, entityId, place, say(c, key));
  if (!held) return refuse('drop.not_held');
  if (held.slot) return refuse('drop.worn');
  if (c.world.catalog.get(held.item)?.type === 'key') return refuse('drop.key');
  const qty = Math.floor(Number(req?.qty));
  const error = piece ? removePiece(inv, ref) : removeStack(inv, stackKey(held.item, (stack as { quality: string }).quality), qty);
  if (error) return refuse('drop.not_held');
  await saveGear(c.world.pool, entityId, inv, state.progress);
  return statusPanel(c, entityId, place, say(c, 'drop.done'));
}
