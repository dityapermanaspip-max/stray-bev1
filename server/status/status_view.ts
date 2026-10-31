import type { BalanceConfig, BodyResource } from '../config/balance.ts';
import { bodyTier } from '../battle/rules.ts';
import type { Inventory } from '../inventory/bag.ts';
import { buildBagView, type BagView } from '../inventory/bag_view.ts';
import type { ItemCatalog } from '../inventory/items.ts';
import type { BodyNow } from '../data/entity_load.ts';
import { progressStats, type Progress } from '../growth/level_up.ts';
import { slotOf, type Loadout } from '../loadout/loadout.ts';
import type { LinePicker } from '../presentation/line_picker.ts';
import { moveLevelWordTier } from '../stats/curves.ts';
import { calcDerived } from '../stats/derived.ts';
import type { Rng } from '../util/rng.ts';

// The status window payload. It is what the owner's client receives: tiers, keys and sentences only.
// No stats, levels, exp, or pool numbers. Slot positions are layout, not hidden values.

export type StatusView = {
  body: { resource: BodyResource; tier: number; text: string | null }[];
  slots: { slot: number; move: string | null }[];
  moves: { move: string; name: string; mastery: number; slot: number | null; isNew: boolean }[];
  bag: BagView | null;
};

export type StatusInput = {
  cfg: BalanceConfig;
  lines: LinePicker;
  rng: Rng;
  speaker: string;
  progress: Progress;
  loadout: Loadout;
  body: BodyNow | null;
  unseen: ReadonlySet<string>;
  bag?: { catalog: ItemCatalog; inventory: Inventory };
};

const RESOURCES: BodyResource[] = ['hp', 'stamina', 'mana'];
const NAME_PREFIX = 'move_name_';

export function buildStatusView(input: StatusInput): StatusView {
  const { cfg, lines, rng, speaker, progress, loadout, body, unseen } = input;
  const derived = calcDerived(progressStats(progress), cfg.derived);
  const max = { hp: derived.maxHp, stamina: derived.maxStamina, mana: derived.maxMana };

  const bodyView = RESOURCES.map((resource) => {
    const tier = bodyTier(cfg, resource, body ? body[resource] : max[resource], max[resource]);
    return { resource, tier, text: lines.pick(rng, `body.${resource}`, tier, speaker)?.text ?? null };
  });

  const slots = Array.from({ length: cfg.loadoutSlots }, (_, i) => ({ slot: i + 1, move: loadout.get(i + 1) ?? null }));

  const moves = [...progress.moves]
    .map(([move, known]) => ({
      move,
      name: lines.pick(rng, NAME_PREFIX + move)?.text ?? move,
      mastery: moveLevelWordTier(cfg, known.level),
      slot: slotOf(loadout, move),
      isNew: unseen.has(move),
    }))
    .sort((a, b) => (a.slot ?? Infinity) - (b.slot ?? Infinity) || a.name.localeCompare(b.name));

  const bag = input.bag
    ? buildBagView(cfg, input.bag.catalog, lines, rng, speaker, input.bag.inventory, derived.maxInventoryWeight)
    : null;
  return { body: bodyView, slots, moves, bag };
}
