import type { BalanceConfig } from '../config/balance.ts';
import type { LinePicker } from '../presentation/line_picker.ts';
import type { Rng } from '../util/rng.ts';
import { carriedWeight, conditionTier, loadTier, stackKey, type Inventory } from './bag.ts';
import { equipped } from './gear.ts';
import { fitsSlot, type ItemCatalog } from './items.ts';
import { carcassData, freshnessTier } from './loot.ts';

// The bag part of the status window. Names, counts (allowed), slots, load and condition tiers.
// Carcasses also show a freshness tier (1 fresh .. 4 rotten). No weights, durability, power or effect numbers.

export type BagView = {
  load: { tier: number; text: string | null };
  slots: { slot: string; label: string | null; accepts: string; item: string | null }[];
  items: { ref: string; item: string; name: string; qty: number; slot: string | null; wearable: boolean; fits: string | null; edible: boolean; droppable: boolean; condition: number | null;
    freshness: { tier: number; text: string | null } | null }[];
};

export const ITEM_NAME_PREFIX = 'item_name_';
export const GEAR_SLOT_PREFIX = 'gear_slot_'; // + a gear slot: its name (one line; the startup check lists it as GEAR_SLOT_NAME)

export function buildBagView(
  cfg: BalanceConfig,
  catalog: ItemCatalog,
  lines: LinePicker,
  rng: Rng,
  speaker: string,
  inv: Inventory,
  maxWeight: number,
  now: number = Date.now(),
): BagView {
  const name = (item: string) => lines.pick(rng, ITEM_NAME_PREFIX + item)?.text ?? item;
  const wearable = (item: string) => { const def = catalog.get(item); return !!def && fitsSlot(def) !== null; };
  const edible = (item: string) => catalog.get(item)?.edible === true;
  const fits = (item: string) => { const def = catalog.get(item); return def ? fitsSlot(def) : null; };
  const droppable = (item: string) => catalog.get(item)?.type !== 'key'; // keys are bound: they stay
  const tier = loadTier(cfg, carriedWeight(cfg, catalog, inv), maxWeight);
  const worn = equipped(inv);
  const freshnessOf = (p: (typeof inv.pieces)[number]) => {
    const carcass = carcassData(p);
    if (!carcass) return null;
    const fresh = freshnessTier(cfg, carcass.killedAt, now);
    return { tier: fresh, text: lines.pick(rng, 'carcass.freshness', fresh)?.text ?? null };
  };

  const stacks = [...inv.stacks.values()].map((s) => ({
    ref: stackKey(s.item, s.quality), item: s.item, name: name(s.item), qty: s.qty, slot: s.slot, wearable: wearable(s.item), fits: fits(s.item), edible: edible(s.item), droppable: droppable(s.item),
    condition: null, freshness: null,
  }));
  const pieces = inv.pieces.map((p) => ({
    ref: p.id, item: p.item, name: name(p.item), qty: 1, slot: p.slot, wearable: wearable(p.item), fits: fits(p.item), edible: edible(p.item), droppable: droppable(p.item),
    condition: conditionTier(cfg, p.durability, catalog.get(p.item)?.maxDurability ?? 0),
    freshness: freshnessOf(p),
  }));

  return {
    load: { tier, text: lines.pick(rng, 'load', tier, speaker)?.text ?? null },
    slots: cfg.gear.slots.map((s) => {
      const held = worn.get(s.slot);
      return { slot: s.slot, label: lines.pick(rng, GEAR_SLOT_PREFIX + s.slot)?.text ?? null, accepts: s.accepts, item: held ? name(held.item) : null };
    }),
    items: [...pieces, ...stacks].sort((a, b) => Number(!a.slot) - Number(!b.slot) || a.name.localeCompare(b.name)),
  };
}
