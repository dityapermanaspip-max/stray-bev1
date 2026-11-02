import { parseArgs } from 'node:util';
import { loadEntityState } from '../data/entity_load.ts';
import { saveBattleResults, saveLoadout } from '../data/entity_save.ts';
import { createPool } from '../db/pool.ts';
import { loadGameWorld, placePlayer } from '../game/world.ts';
import { addMoveExp } from '../growth/level_up.ts';
import { learnUnlocks } from '../growth/unlocks.ts';
import { slottable } from '../loadout/loadout.ts';
import { moveExpRequired } from '../stats/curves.ts';
import { createRng } from '../util/rng.ts';

// Dev tool: grows a test player to a total of --levels move levels (default 150) for testing the inner rings.
//   npm run dev:veteran -- --name veteran --levels 150 --seed 1
// Joins like the dev client does (found or created by name, placed in the dev round with the starting purse), then
// trains its known moves one level at a time through addMoveExp, so stat exp comes only from move level-ups, and
// learns unlocks after every level-up as a battle would. Ends by equipping the best moves and saving.
// Run it again on the same name to top up; it never lowers anything. Log in with that name to play it.

const { values } = parseArgs({
  options: {
    name: { type: 'string', default: 'veteran' },
    levels: { type: 'string', default: '150' },
    seed: { type: 'string', default: '1' },
  },
});

const pool = createPool();
try {
  const world = await loadGameWorld(pool);
  const { cfg, moves, unlocks } = world.data;
  const goal = Math.max(1, Math.floor(Number(values.levels)));
  const { entityId } = await placePlayer(world, values.name!);
  const state = await loadEntityState(pool, entityId);
  const { progress } = state;
  const parts = new Set(state.bodyParts);
  const rng = createRng(Number(values.seed) >>> 0);

  // Battle moves the body can use (no life skills: those grow from their own work).
  const trainable = () => [...progress.moves].filter(([name, known]) => {
    const def = moves.get(name);
    return def && def.category !== 'life' && known.level < cfg.moveLevelCap
      && def.requires.every((r) => r.kind !== 'body_part' || parts.has(String(r.value)));
  }).map(([name]) => name);
  const total = () => [...progress.moves.values()].reduce((n, m) => n + m.level, 0);

  const learned: string[] = [];
  for (let open = trainable(); total() < goal && open.length > 0; open = trainable()) {
    const name = open[Math.floor(rng() * open.length)];
    const known = progress.moves.get(name)!;
    const def = moves.get(name)!;
    const need = moveExpRequired(cfg, known.level) - known.exp;
    addMoveExp(progress, name, need, { statExp: def.statExp, expScaling: def.expScaling, tier: def.tier, tags: def.tags }, cfg);
    learned.push(...learnUnlocks(unlocks, progress).map((l) => l.move));
  }

  // The best moves by level go into the loadout (life skills stay out, as the status window would refuse them).
  const best = [...progress.moves].filter(([name]) => slottable(moves, name)).sort((a, b) => b[1].level - a[1].level)
    .slice(0, cfg.loadoutSlots);
  const loadout = new Map(best.map(([name], i) => [i + 1, name]));
  await saveBattleResults(pool, [{ entityId, progress, body: null }]);
  await saveLoadout(pool, entityId, loadout);

  const stats = Object.entries(progress.stats).map(([s, p]) => `${s} ${p.base}`).join(' · ');
  console.log(`${values.name} (${entityId}): ${total()} move levels over ${progress.moves.size} moves, ${learned.length} learned on the way`);
  console.log(`stats: ${stats}`);
  console.log(`loadout: ${best.map(([n, m]) => `${n} ${m.level}`).join(', ')}`);
} finally {
  await pool.end();
}
