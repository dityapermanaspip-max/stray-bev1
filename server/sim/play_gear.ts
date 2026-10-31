import type pg from 'pg';
import type { BalanceConfig } from '../config/balance.ts';
import type { EntityState } from '../data/entity_load.ts';
import { saveGear } from '../data/entity_save.ts';
import { loadInventory } from '../data/item_repo.ts';
import { addItem, stackKey, stacksOf, type Inventory } from '../inventory/bag.ts';
import { equipGear, equipLineKey, unequipGear, unequipLineKey, type GearRef } from '../inventory/gear.ts';
import type { ItemCatalog } from '../inventory/items.ts';
import type { LinePicker } from '../presentation/line_picker.ts';
import { createRng } from '../util/rng.ts';

// Dev bag and gear actions for `npm run play`: --give item:qty, --wear item[:slot], --remove slot.

export type GearArgs = { give: string[]; wear: string[]; remove: string[] };
const PLACE = { inTown: true, inBattle: false }; // the dev CLI acts as if standing in a town

// The first held piece of that item not already worn, else its stack.
function refFor(inv: Inventory, item: string): GearRef | null {
  const piece = inv.pieces.find((p) => p.item === item && !p.slot) ?? inv.pieces.find((p) => p.item === item);
  if (piece) return { piece: piece.id };
  const stack = stacksOf(inv, item)[0];
  return stack ? { stack: stackKey(stack.item, stack.quality) } : null;
}

export async function applyGearArgs(
  pool: pg.Pool,
  cfg: BalanceConfig,
  catalog: ItemCatalog,
  lines: LinePicker,
  state: EntityState,
  args: GearArgs,
): Promise<Inventory> {
  const inv = await loadInventory(pool, state.id);
  if (args.give.length + args.wear.length + args.remove.length === 0) return inv;
  const rng = createRng(7);
  const say = (key: string) => console.log(`  "${lines.pick(rng, key, 0, 'self')?.text ?? key}"`);

  for (const pair of args.give) {
    const [item, qty] = pair.split(':');
    const error = addItem(catalog, inv, item, Number(qty ?? 1));
    if (error) throw new Error(`give ${item} refused: ${error}`);
  }
  for (const slot of args.remove) {
    const change = unequipGear(cfg, inv, slot, PLACE);
    if (typeof change === 'string') throw new Error(`remove ${slot} refused: ${change}`);
    say(unequipLineKey(change.kind));
  }
  for (const pair of args.wear) {
    const [item, slot] = pair.split(':');
    const ref = refFor(inv, item);
    if (!ref) throw new Error(`wear ${item} refused: not_held`);
    const change = equipGear(cfg, catalog, inv, state.progress, ref, PLACE, slot ?? null);
    if (typeof change === 'string') throw new Error(`wear ${item} refused: ${change}`);
    say(equipLineKey(change.kind));
    if (change.learned) {
      say('epiphany_weapon');
      console.log(`  (learned ${change.learned})`);
    }
  }
  await saveGear(pool, state.id, inv, state.progress);
  return inv;
}
