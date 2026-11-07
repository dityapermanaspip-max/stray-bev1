import { ammoTotals } from '../../battle/factory.ts';
import { hasTraitFlag } from '../../growth/traits.ts';
import { removeStack, stackKey } from '../../inventory/bag.ts';
import { ITEM_NAME_PREFIX } from '../../inventory/bag_view.ts';
import { buildCombatGear } from '../../inventory/combat_gear.ts';
import { equipGear, unequipGear, type GearRef } from '../../inventory/gear.ts';
import type { Rng } from '../../util/rng.ts';
import type { BattleGearView } from '../../../shared/battle.ts';
import type { GearRequest } from '../../../shared/town.ts';
import type { GameWorld } from '../world.ts';
import type { Fight } from './battle_setup.ts';

// Changing what the player holds in the middle of a fight (the battle menu): weapons, shields and throwable stacks only,
// the hands only, the player only. It spends the turn (BattleInstance.restock). Throws already made are settled first
// (spent ones are gone, none come back), then the battle gear is built again from the bag with the fight's wear and
// fired-ammo counts carried over. The bag itself is changed in place and saved with the fight.

const HANDS = ['main_hand', 'off_hand'];
const PLACE = { inTown: false, inBattle: false }; // the battle swap rule lives in the room: a full gauge, hands only

const handOf = (slot: string | null) => (slot && HANDS.includes(slot) ? slot : null);

export function gearView(world: GameWorld, rng: Rng, f: Fight): BattleGearView {
  const name = (item: string) => world.data.lines.pick(rng, ITEM_NAME_PREFIX + item)?.text ?? item;
  const wields = (item: string) => !!world.catalog.get(item)?.wield;
  const hands = [
    ...f.inventory.pieces.flatMap((p) => (p.slot && HANDS.includes(p.slot) ? [{ slot: p.slot, name: name(p.item) }] : [])),
    ...[...f.inventory.stacks.values()].flatMap((s) => (s.slot && HANDS.includes(s.slot) ? [{ slot: s.slot, name: name(s.item) }] : [])),
  ];
  const items = [
    ...f.inventory.pieces.filter((p) => wields(p.item)).map((p) => ({ ref: p.id, name: name(p.item), qty: 1, slot: handOf(p.slot) })),
    ...[...f.inventory.stacks.values()].filter((s) => wields(s.item)).map((s) => ({ ref: stackKey(s.item, s.quality), name: name(s.item), qty: s.qty, slot: handOf(s.slot) })),
  ];
  return { hands, items };
}

// Answers true when the hands changed (the caller spends the turn), false when nothing was done.
export function swapGear(world: GameWorld, f: Fight, req: GearRequest): boolean {
  const { cfg } = world.data;
  const inv = f.inventory;
  const wearRef = req && 'wear' in req ? String(req.wear) : null;
  const slot = req && 'remove' in req ? String(req.remove) : req && 'slot' in req && req.slot ? String(req.slot) : null;
  if (wearRef) {
    const item = inv.pieces.find((p) => p.id === wearRef)?.item ?? inv.stacks.get(wearRef)?.item ?? '';
    if (!world.catalog.get(item)?.wield) return false; // only things held in the hands
  } else if (!slot || !HANDS.includes(slot)) return false;
  if (slot && !HANDS.includes(slot)) return false;

  const old = f.player.gear;
  const spentKey = old.weapon?.thrownItem;
  const spent = old.thrownSpent;
  const ref: GearRef = wearRef ? (inv.pieces.some((p) => p.id === wearRef) ? { piece: wearRef } : { stack: wearRef }) : { piece: '' };
  const change = wearRef
    ? equipGear(cfg, world.catalog, inv, f.state.progress, ref, PLACE, slot, hasTraitFlag(f.state.traits, 'dual_wield'))
    : unequipGear(cfg, inv, slot!, PLACE);
  if (typeof change === 'string') return false;
  if (spentKey && spent > 0) removeStack(inv, spentKey, Math.min(spent, inv.stacks.get(spentKey)?.qty ?? 0)); // thrown and gone

  const gear = buildCombatGear(cfg, world.catalog, inv);
  gear.wear = old.wear;
  gear.ammoSpent = old.ammoSpent;
  const e = f.player;
  e.gear = gear;
  e.weaponType = gear.weaponType;
  e.ammo = new Map(ammoTotals(gear).map(([type, qty]) => [type, Math.max(0, qty - (gear.ammoSpent.get(type) ?? 0))]));
  return true;
}
