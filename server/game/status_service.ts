import { loadEntityState } from '../data/entity_load.ts';
import { markMovesSeen, saveGear, saveLoadout } from '../data/entity_save.ts';
import { loadInventory } from '../data/item_repo.ts';
import { equipGear, equipLineKey, unequipGear, unequipLineKey, type GearRef } from '../inventory/gear.ts';
import { canSwap, equip, unequip, type SwapPlace } from '../loadout/loadout.ts';
import { buildStatusView } from '../status/status_view.ts';
import type { Rng } from '../util/rng.ts';
import type { GearRequest, LoadoutRequest, StatusPanel } from '../../shared/town.ts';
import type { GameWorld } from './world.ts';

// The status window from the field: body words, moves and slots, the bag. Loadout and gear changes are
// allowed only inside a town's safe square (or with the testing flag), never in battle.

type Ctx = { world: GameWorld; rng: Rng };

const say = (c: Ctx, key: string) => c.world.data.lines.pick(c.rng, key, 0, 'self')?.text ?? null;
const refusal = (error: string) => (error === 'not_in_town' ? 'loadout.not_here' : 'battle.cannot');

export async function statusPanel(c: Ctx, entityId: string, place: SwapPlace, line: string | null = null): Promise<StatusPanel> {
  const { cfg, lines } = c.world.data;
  const [state, inventory] = await Promise.all([loadEntityState(c.world.pool, entityId), loadInventory(c.world.pool, entityId)]);
  const view = buildStatusView({
    cfg, lines, rng: c.rng, speaker: 'self', progress: state.progress, loadout: state.loadout, body: state.body, unseen: state.unseen,
    bag: { catalog: c.world.catalog, inventory },
  });
  await markMovesSeen(c.world.pool, entityId);
  return { ...view, canSwap: canSwap(cfg, place) === null, line };
}

export async function changeLoadout(c: Ctx, entityId: string, place: SwapPlace, req: LoadoutRequest): Promise<StatusPanel> {
  const { cfg, moves } = c.world.data;
  const state = await loadEntityState(c.world.pool, entityId);
  const slot = Math.floor(Number(req?.slot));
  const error = req?.move ? equip(cfg, state.loadout, state.progress, moves, slot, String(req.move), place) : unequip(cfg, state.loadout, slot, place);
  if (error) return statusPanel(c, entityId, place, say(c, refusal(error)));
  await saveLoadout(c.world.pool, entityId, state.loadout);
  return statusPanel(c, entityId, place);
}

export async function changeGear(c: Ctx, entityId: string, place: SwapPlace, req: GearRequest): Promise<StatusPanel> {
  const { cfg } = c.world.data;
  const [state, inv] = await Promise.all([loadEntityState(c.world.pool, entityId), loadInventory(c.world.pool, entityId)]);
  let change;
  if (req && 'remove' in req) {
    change = unequipGear(cfg, inv, String(req.remove), place);
  } else {
    const ref = String(req?.wear ?? '');
    const gearRef: GearRef = inv.pieces.some((p) => p.id === ref) ? { piece: ref } : { stack: ref };
    change = equipGear(cfg, c.world.catalog, inv, state.progress, gearRef, place, req?.slot ? String(req.slot) : null);
  }
  if (typeof change === 'string') return statusPanel(c, entityId, place, say(c, refusal(change)));
  await saveGear(c.world.pool, entityId, inv, state.progress);
  const key = req && 'remove' in req ? unequipLineKey(change.kind) : equipLineKey(change.kind);
  return statusPanel(c, entityId, place, say(c, change.learned ? 'epiphany_weapon' : key));
}
