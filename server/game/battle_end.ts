import { bodyOf } from '../battle/from_state.ts';
import { deleteBattle } from '../data/battle_repo.ts';
import { saveBattleResults } from '../data/entity_save.ts';
import { insertCorpses } from '../data/loot_repo.ts';
import { removeKilled } from '../data/population_repo.ts';
import { loadWake, savePosition } from '../data/position_repo.ts';
import { ITEM_NAME_PREFIX } from '../inventory/bag_view.ts';
import { shareCarcasses } from '../inventory/carcass.ts';
import { applyBattleWear } from '../inventory/combat_gear.ts';
import type { CarcassData } from '../inventory/loot.ts';
import type { Rng } from '../util/rng.ts';
import type { BattleResultView } from '../../shared/battle.ts';
import type { Fight } from './battle_setup.ts';
import { gridFor, populationHome, type GameWorld } from './world.ts';

// End of a field battle, saved in one transaction: growth, body, gear wear, carcasses taken, corpses left,
// creatures killed off the field's counts, and the battle snapshot removed.
// A win keeps the player on the tile where the creatures jumped out. Passing out wakes them rested in the
// middle of the last town they entered (or at this field's entry if they never entered one).

export function killsOf(f: Fight, now: number): CarcassData[] {
  return f.foes.flatMap((e, i) => (e.hp > 0 ? [] : [{
    species: f.order.foes[i].species, corrupted: e.corrupted,
    totalStats: Object.values(e.stats).reduce((a, b) => a + b, 0), killedAt: now,
  }]));
}

type EndWorld = { world: GameWorld; rng: Rng };

export async function finishFight({ world, rng }: EndWorld, f: Fight, battleId: string): Promise<BattleResultView> {
  const { cfg, lines } = world.data;
  const won = f.instance.winner === f.player.side;
  const say = (key: string) => lines.pick(rng, key, 0, 'self')?.text;
  const out: BattleResultView = { won, lines: [], taken: [] };
  const note = (key: string) => {
    const text = say(key);
    if (text) out.lines.push(text);
  };
  note(won ? 'battle.won' : 'battle.lost');

  applyBattleWear(cfg, f.inventory, f.player.gear, won, f.player.stats.luck, rng);
  const kills = killsOf(f, Date.now());
  let left = kills;
  if (won && kills.length > 0) {
    const maxWeight = f.player.derived.maxInventoryWeight;
    const shared = shareCarcasses(cfg, world.catalog, [{ id: f.player.id, inv: f.inventory, maxWeight }], kills);
    left = shared.left;
    for (const t of shared.taken) {
      const found = out.taken.find((x) => x.item === t.item);
      if (found) found.qty += 1;
      else out.taken.push({ item: t.item, name: lines.pick(rng, ITEM_NAME_PREFIX + t.item)?.text ?? t.item, qty: 1 });
    }
    if (shared.taken.length > 0) note('loot.carcass.take');
  }
  if (won && left.length > 0) note('loot.carcass.left');

  const { fieldRef } = f.order;
  const home = populationHome(world, fieldRef);
  const saved = won ? null : await loadWake(world.pool, f.player.id);
  const wakeRef = won ? null : saved && world.links.hexes.has(saved) ? saved : fieldRef; // a town of an ended round does not count
  const wakeSpot = wakeRef ? (await gridFor(world, wakeRef))?.grid.spawn ?? null : null;
  const wake = wakeRef && wakeSpot ? { ref: wakeRef, ...wakeSpot } : null;
  await saveBattleResults(
    world.pool,
    [{ entityId: f.player.id, progress: f.state.progress, body: won ? bodyOf(f.player) : null, inventory: f.inventory }],
    async (client) => {
      if (left.length > 0) await insertCorpses(client, fieldRef, left);
      if (home && kills.length > 0) await removeKilled(client, home, kills);
      if (wake) await savePosition(client, f.player.id, { fieldRef: wake.ref, x: wake.x, y: wake.y });
      await deleteBattle(client, battleId);
    },
  );
  return out;
}
