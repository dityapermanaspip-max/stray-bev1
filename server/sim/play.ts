import { parseArgs } from 'node:util';
import { bodyOf, growerEntity } from '../battle/from_state.ts';
import { BattleInstance } from '../battle/instance.ts';
import type { BattleEntity } from '../battle/types.ts';
import { findEntityByName, loadEntityState } from '../data/entity_load.ts';
import { createPlayer, markMovesSeen, saveBattleResults, saveBody, saveLoadout } from '../data/entity_save.ts';
import { loadInventory, loadItemCatalog } from '../data/item_repo.ts';
import { loadLoot } from '../data/loot_repo.ts';
import { loadBattleData, loadSpecies } from '../data/species_repo.ts';
import { createPool } from '../db/pool.ts';
import { learnUnlocks } from '../growth/unlocks.ts';
import { applyBattleWear, buildCombatGear } from '../inventory/combat_gear.ts';
import { equip, unequip } from '../loadout/loadout.ts';
import { buildStatusView } from '../status/status_view.ts';
import { createRng } from '../util/rng.ts';
import { buildCreature } from './combatants.ts';
import { applyGearArgs } from './play_gear.ts';
import { applyLootArgs, takeCarcasses } from './play_loot.ts';

// Dev round trip through the database: load a player, change the loadout, fight, save, show the status window.
// npm run play -- --name dev --enemies chicken,cat --seed 3 [--set-move jab:6] [--equip 3:jab] [--unequip 2] [--inn] [--no-fight]
//   [--give iron_sword:1] [--wear iron_sword[:main_hand]] [--remove off_hand]
//   [--learn butchery] [--age-hours 30] [--butcher npc_pay|npc_cut|self|sell_shop|sell_butcher]
// --set-move is a dev shortcut: it sets a move level (learning it if needed), then runs the unlock check.

const { values } = parseArgs({
  options: {
    name: { type: 'string', default: 'dev' },
    race: { type: 'string', default: 'human' },
    enemies: { type: 'string', default: 'chicken' },
    corrupted: { type: 'boolean', default: false },
    ring: { type: 'string' }, // where the foes are met (default the outer ring)
    seed: { type: 'string', default: String(Date.now() % 100000) },
    'set-move': { type: 'string', multiple: true, default: [] },
    equip: { type: 'string', multiple: true, default: [] },
    unequip: { type: 'string', multiple: true, default: [] },
    give: { type: 'string', multiple: true, default: [] },
    wear: { type: 'string', multiple: true, default: [] },
    remove: { type: 'string', multiple: true, default: [] },
    inn: { type: 'boolean', default: false },
    'no-fight': { type: 'boolean', default: false },
    learn: { type: 'string', multiple: true, default: [] },
    'age-hours': { type: 'string', default: '0' },
    butcher: { type: 'string', multiple: true, default: [] },
  },
});

const PLACE = { inTown: true, inBattle: false }; // the dev CLI acts as if standing in a town
const pool = createPool();
try {
  const data = await loadBattleData(pool);
  const { cfg } = data;
  const id = (await findEntityByName(pool, 'player', values.name!)) ?? (await createPlayer(pool, cfg, values.name!, values.race!));
  let state = await loadEntityState(pool, id);

  if (values.inn) {
    await saveBody(pool, id, null);
    console.log('A night at the inn. Body restored.');
  }
  if (values['set-move']!.length > 0) {
    for (const pair of values['set-move']!) {
      const [move, level] = pair.split(':');
      if (!data.moves.has(move)) throw new Error(`unknown move ${move}`);
      state.progress.moves.set(move, { level: Math.min(cfg.moveLevelCap, Math.max(1, Number(level) || 1)), exp: 0 });
    }
    for (const l of learnUnlocks(data.unlocks, state.progress)) console.log(`  (learned ${l.move})`);
    await saveBattleResults(pool, [{ entityId: id, progress: state.progress, body: state.body }]);
  }
  // Gear first: equipping a weapon may teach the move the loadout change wants.
  const catalog = await loadItemCatalog(pool);
  await applyGearArgs(pool, cfg, catalog, data.lines, state, { give: values.give!, wear: values.wear!, remove: values.remove! });
  const lootWorld = { cfg, catalog, lines: data.lines, moves: data.moves, loot: await loadLoot(pool) };
  state = await loadEntityState(pool, id);
  const changes = [
    ...values.unequip!.map((slot) => () => unequip(cfg, state.loadout, Number(slot), PLACE)),
    ...values.equip!.map((pair) => {
      const [slot, move] = pair.split(':');
      return () => equip(cfg, state.loadout, state.progress, data.moves, Number(slot), move, PLACE);
    }),
  ];
  for (const change of changes) {
    const error = change();
    if (error) throw new Error(`loadout change refused: ${error}`);
  }
  if (changes.length > 0) await saveLoadout(pool, id, state.loadout);
  state = await loadEntityState(pool, id);

  if (!values['no-fight']) await fight(state);

  state = await loadEntityState(pool, id);
  await applyLootArgs(pool, lootWorld, state, {
    learn: values.learn!, ageHours: Number(values['age-hours']), butcher: values.butcher!, seed: Number(values.seed),
  });

  state = await loadEntityState(pool, id);
  const view = buildStatusView({
    cfg, lines: data.lines, rng: createRng(1), speaker: 'self',
    progress: state.progress, loadout: state.loadout, body: state.body, unseen: state.unseen,
    bag: { catalog, inventory: await loadInventory(pool, id) },
  });
  console.log('\nStatus window payload (what the owner client receives):');
  console.log(JSON.stringify(view, null, 2));
  await markMovesSeen(pool, id);

  async function fight(s: typeof state): Promise<void> {
    if (s.body && s.body.hp <= 0) {
      console.log('Still passed out. Run with --inn first.');
      return;
    }
    const species = await loadSpecies(pool);
    const inventory = await loadInventory(pool, s.id);
    const player = growerEntity(cfg, {
      id: s.id, kind: 'player', side: 'party', slot: s.slot, speaker: 'self', controller: 'ai',
      progress: s.progress, loadout: s.loadout, bodyParts: s.bodyParts, body: s.body,
      gear: buildCombatGear(cfg, catalog, inventory),
    });
    const roll = createRng(Number(values.seed) + 1);
    const foes: BattleEntity[] = values.enemies!.split(',').map((name, i) => {
      const def = species.get(name.trim());
      if (!def) throw new Error(`unknown species ${name}`);
      return buildCreature(cfg, def, i + 1, values.corrupted!, Number(values.ring ?? cfg.rings.count), roll);
    });
    const battle = new BattleInstance(data, {
      entities: [player, ...foes],
      progress: new Map([[s.id, s.progress]]),
      summonerSides: new Set(),
      seed: Number(values.seed),
    });
    let dealt = 0;
    for (let t = 0; !battle.winner && t < 600_000; t += cfg.combat.atbTickMs) {
      for (const e of battle.tick(cfg.combat.atbTickMs)) {
        if (e.type === 'damage' && e.source === s.id) dealt += e.amount;
        if (e.type === 'line' && e.entity === s.id) console.log(`  "${e.text}"`);
        if (e.type === 'learned') console.log(`  (learned ${e.move})`);
      }
    }
    console.log(`Battle over: ${battle.winner === 'party' ? 'won' : 'passed out'}, damage dealt ${dealt}.`);
    const wear = applyBattleWear(cfg, inventory, player.gear, battle.winner === 'party', player.stats.luck, createRng(Number(values.seed) + 1));
    if (wear.broken.length > 0) console.log(`  (broke: ${wear.broken.join(', ')})`);
    if (player.gear.thrownSpent > 0) console.log(`  (threw ${player.gear.thrownSpent}, picked ${wear.thrownBack} back up)`);
    if (battle.winner === 'party') {
      const now = Date.now();
      const kills = foes.filter((f) => f.hp <= 0).map((f) => ({
        species: f.id.replace(/_\d+$/, ''), corrupted: f.corrupted,
        totalStats: Object.values(f.stats).reduce((a, b) => a + b, 0), killedAt: now,
      }));
      await takeCarcasses(pool, lootWorld, inventory, player.derived.maxInventoryWeight, kills, Number(values.seed));
    }
    await saveBattleResults(pool, [{ entityId: s.id, progress: s.progress, body: bodyOf(player), inventory }]);
  }
} catch (err) {
  console.error(`Play failed: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
