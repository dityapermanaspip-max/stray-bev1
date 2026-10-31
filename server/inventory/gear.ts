import type { BalanceConfig } from '../config/balance.ts';
import type { Progress } from '../growth/level_up.ts';
import { canSwap, type SwapPlace } from '../loadout/loadout.ts';
import { stackKey, type Inventory } from './bag.ts';
import { fitsSlot, type ItemCatalog } from './items.ts';

// Wearing and wielding. Same swap rule as the loadout: in town only, never in battle (config flag lifts town).
// Two-handed weapons take the main hand and keep the off hand empty.
// The first equip of a weapon teaches its basic move (known, not put in the move loadout).

export type GearError = 'in_battle' | 'not_in_town' | 'not_held' | 'not_wearable' | 'bad_slot';
export type GearRef = { piece: string } | { stack: string }; // stack = stack key (item@quality)
export type Held = { ref: GearRef; item: string };
export type GearChange = { kind: string; item: string; learned: string | null; freed: Held[] };

const MAIN = 'main_hand';
const OFF = 'off_hand';

// Slot -> what sits there.
export function equipped(inv: Inventory): Map<string, Held> {
  const out = new Map<string, Held>();
  for (const p of inv.pieces) if (p.slot) out.set(p.slot, { ref: { piece: p.id }, item: p.item });
  for (const s of inv.stacks.values()) if (s.slot) out.set(s.slot, { ref: { stack: stackKey(s.item, s.quality) }, item: s.item });
  return out;
}

const slotKind = (cfg: BalanceConfig, slot: string) => cfg.gear.slots.find((s) => s.slot === slot)?.kind ?? 'wear';

function setSlot(inv: Inventory, ref: GearRef, slot: string | null): void {
  if ('piece' in ref) inv.pieces.find((p) => p.id === ref.piece)!.slot = slot;
  else inv.stacks.get(ref.stack)!.slot = slot;
}

function clearSlot(inv: Inventory, slot: string): Held | null {
  const held = equipped(inv).get(slot);
  if (!held) return null;
  setSlot(inv, held.ref, null);
  return held;
}

function find(inv: Inventory, ref: GearRef): { item: string; slot: string | null } | null {
  if ('piece' in ref) return inv.pieces.find((p) => p.id === ref.piece) ?? null;
  return inv.stacks.get(ref.stack) ?? null;
}

const sameRef = (a: GearRef, b: GearRef) =>
  'piece' in a ? 'piece' in b && a.piece === b.piece : 'stack' in b && a.stack === b.stack;

export function equipGear(
  cfg: BalanceConfig,
  catalog: ItemCatalog,
  inv: Inventory,
  progress: Progress,
  ref: GearRef,
  place: SwapPlace,
  wanted: string | null = null,
): GearError | GearChange {
  const blocked = canSwap(cfg, place);
  if (blocked) return blocked as GearError;
  const held = find(inv, ref);
  if (!held) return 'not_held';
  const def = catalog.get(held.item)!;
  const fits = fitsSlot(def);
  if (!fits) return 'not_wearable';

  const twoHanded = def.wield?.hands === 2 && !def.worn;
  const candidates = cfg.gear.slots.filter((s) => s.accepts === fits).map((s) => s.slot);
  if (wanted !== null && (!candidates.includes(wanted) || (twoHanded && wanted !== MAIN))) return 'bad_slot';
  const now = equipped(inv);
  const slot = twoHanded ? MAIN : (wanted ?? candidates.find((s) => !now.has(s)) ?? candidates[0]);

  if (held.slot) setSlot(inv, ref, null);
  const freed: Held[] = [];
  const free = (s: string) => {
    const out = clearSlot(inv, s);
    if (out && !sameRef(out.ref, ref)) freed.push(out);
  };
  free(slot);
  if (twoHanded) free(OFF);
  if (slot === OFF) {
    const main = equipped(inv).get(MAIN);
    if (main && catalog.get(main.item)!.wield?.hands === 2) free(MAIN);
  }
  setSlot(inv, ref, slot);
  inv.known.add(held.item);

  let learned: string | null = null;
  const grants = def.wield?.grantsMove ?? null;
  if (grants && !progress.moves.has(grants)) {
    progress.moves.set(grants, { level: 1, exp: 0 });
    learned = grants;
  }
  return { kind: slotKind(cfg, slot), item: held.item, learned, freed };
}

export function unequipGear(cfg: BalanceConfig, inv: Inventory, slot: string, place: SwapPlace): GearError | GearChange {
  const blocked = canSwap(cfg, place);
  if (blocked) return blocked as GearError;
  if (!cfg.gear.slots.some((s) => s.slot === slot)) return 'bad_slot';
  const out = clearSlot(inv, slot);
  if (!out) return 'not_held';
  return { kind: slotKind(cfg, slot), item: out.item, learned: null, freed: [out] };
}

// Line keys for a change. The battle and the status window send keys and sentences, never item data.
export const equipLineKey = (kind: string) => `gear.equip.${kind}`;
export const unequipLineKey = (kind: string) => `gear.unequip.${kind}`;
