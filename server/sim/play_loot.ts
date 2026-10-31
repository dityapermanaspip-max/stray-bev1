import type pg from 'pg';
import type { MoveDef } from '../battle/types.ts';
import type { BalanceConfig } from '../config/balance.ts';
import type { EntityState } from '../data/entity_load.ts';
import { saveGear } from '../data/entity_save.ts';
import { loadInventory } from '../data/item_repo.ts';
import { insertCorpses } from '../data/loot_repo.ts';
import type { Inventory } from '../inventory/bag.ts';
import { butcherCarcass, refusalLine, sellCarcass, type ButcherMode, type Buyer } from '../inventory/butcher.ts';
import { shareCarcasses } from '../inventory/carcass.ts';
import type { ItemCatalog } from '../inventory/items.ts';
import { carcassData, type CarcassData, type LootData } from '../inventory/loot.ts';
import { progressStats } from '../growth/level_up.ts';
import type { LinePicker } from '../presentation/line_picker.ts';
import { createRng } from '../util/rng.ts';

// Dev loot actions for `npm run play`: --learn butchery, --age-hours N, --butcher npc_pay|npc_cut|self|sell_shop|sell_butcher.
// The real flow will run in towns; this checks the numbers through the database.

export type LootArgs = { learn: string[]; ageHours: number; butcher: string[]; seed: number };
export type LootWorld = { cfg: BalanceConfig; catalog: ItemCatalog; lines: LinePicker; moves: Map<string, MoveDef>; loot: LootData };

const sayer = (lines: LinePicker, seed: number) => {
  const rng = createRng(seed);
  return (key: string) => console.log(`  "${lines.pick(rng, key, 0, 'self')?.text ?? key}"`);
};

// After a win: carcasses go to whoever has spare weight (just the player here); the rest stay as field corpses.
export async function takeCarcasses(
  pool: pg.Pool, w: LootWorld, inv: Inventory, maxWeight: number, kills: CarcassData[], seed: number,
): Promise<void> {
  if (kills.length === 0) return;
  const say = sayer(w.lines, seed);
  const shared = shareCarcasses(w.cfg, w.catalog, [{ id: 'player', inv, maxWeight }], kills);
  for (const t of shared.taken) {
    say('loot.carcass.take');
    console.log(`  (took ${t.item})`);
  }
  if (shared.left.length > 0) {
    say('loot.carcass.left');
    await insertCorpses(pool, 'dev', shared.left);
    console.log(`  (left ${shared.left.length} on the field)`);
  }
}

export async function applyLootArgs(pool: pg.Pool, w: LootWorld, state: EntityState, args: LootArgs): Promise<void> {
  if (args.learn.length + args.butcher.length === 0 && !args.ageHours) return;
  const { cfg, catalog } = w;
  const inv = await loadInventory(pool, state.id);
  const say = sayer(w.lines, args.seed);

  for (const move of args.learn) {
    if (!w.moves.has(move)) throw new Error(`unknown move ${move}`);
    if (!state.progress.moves.has(move)) state.progress.moves.set(move, { level: 1, exp: 0 });
    say('epiphany_trainer');
    console.log(`  (learned ${move})`);
  }
  // Pretend time passed: move every carcass's kill time back.
  if (args.ageHours) {
    for (const p of inv.pieces) {
      if (carcassData(p)) p.data = { ...p.data, killed_at: Number(p.data.killed_at) - args.ageHours * 3_600_000 };
    }
  }
  for (const action of args.butcher) {
    const piece = inv.pieces.find((p) => carcassData(p));
    if (!piece) throw new Error(`butcher ${action}: no carcass held`);
    const now = Date.now();
    const rng = createRng(args.seed);
    if (action === 'sell_shop' || action === 'sell_butcher') {
      const sold = sellCarcass(cfg, catalog, inv, piece.id, action.slice(5) as Buyer, now);
      if (typeof sold === 'string') {
        say(refusalLine(sold) ?? sold);
        continue;
      }
      sold.lines.forEach(say);
      console.log(`  (sold ${piece.item} for ${sold.price} copper)`);
      continue;
    }
    const result = butcherCarcass({
      cfg, catalog, loot: w.loot, moves: w.moves, inv, pieceId: piece.id, mode: action as ButcherMode,
      cutter: { progress: state.progress, inv, luck: progressStats(state.progress).luck }, now, rng,
    });
    if (typeof result === 'string') {
      say(refusalLine(result) ?? result);
      continue;
    }
    result.lines.forEach(say);
    const list = (ds: typeof result.drops) => ds.map((d) => `${d.item}@${d.quality} x${d.qty}`).join(', ') || 'nothing';
    console.log(`  (got ${list(result.drops)}${result.fee ? `, paid ${result.fee} copper` : ''}${result.kept.length ? `; butcher kept ${list(result.kept)}` : ''})`);
    for (const g of result.growth) console.log(`  (${g.kind} ${'move' in g ? g.move : g.stat})`);
  }
  await saveGear(pool, state.id, inv, state.progress);
}
