import { parseArgs } from 'node:util';
import { createProgress } from '../battle/factory.ts';
import { BattleInstance } from '../battle/instance.ts';
import type { BattleData, BattleEntity, BattleEvent } from '../battle/types.ts';
import { createPool } from '../db/pool.ts';
import { loadBattleData, loadRaces, loadSpecies } from '../data/species_repo.ts';
import type { Progress } from '../growth/level_up.ts';
import { starterLoadout } from '../loadout/loadout.ts';
import type { CoreStats } from '../stats/derived.ts';
import { buildCreature, buildPlayer } from './combatants.ts';

// Headless battle runner (developer tool, server side only).
// npm run sim -- --enemies chicken,cat --seed 7 [--corrupted] [--debug]

const { values } = parseArgs({
  options: {
    enemies: { type: 'string', default: 'chicken' },
    seed: { type: 'string', default: '1' },
    corrupted: { type: 'boolean', default: false },
    'max-seconds': { type: 'string', default: '600' },
    debug: { type: 'boolean', default: false },
  },
});

const pool = createPool();
try {
  const data = await loadBattleData(pool);
  const [species, races] = await Promise.all([loadSpecies(pool), loadRaces(pool)]);
  const { cfg } = data;

  const playerMoves = cfg.playerStartMoves.map((name) => ({ name, level: 1 }));
  const playerProgress = createProgress(cfg.playerStartStats as CoreStats, playerMoves);
  const entities: BattleEntity[] = [buildPlayer(cfg, playerProgress, starterLoadout(cfg, cfg.playerStartMoves), races.get('human')?.bodyParts ?? [])];
  values.enemies!.split(',').forEach((name, i) => {
    const def = species.get(name.trim());
    if (!def) throw new Error(`unknown species ${name}`);
    entities.push(buildCreature(cfg, def, i + 1, values.corrupted!));
  });

  const progress = new Map<string, Progress>([['player', playerProgress]]);
  const battle = new BattleInstance(data, {
    entities,
    progress,
    summonerSides: new Set(),
    seed: Number(values.seed),
  });

  const maxMs = Number(values['max-seconds']) * 1000;
  let clock = 0;
  while (!battle.winner && clock < maxMs) {
    clock += cfg.combat.atbTickMs;
    for (const event of battle.tick(cfg.combat.atbTickMs)) print(data, clock, event);
  }
  if (!battle.winner) console.log(`[${secs(clock)}] time limit reached`);

  if (values.debug) {
    // Hidden values: developer output only, never sent to a client.
    const p = progress.get('player')!;
    console.log('\n[debug] player moves:', [...p.moves].map(([m, k]) => `${m} L${k.level} (${k.exp.toFixed(1)} exp)`).join(', '));
    console.log('[debug] player stats:', Object.entries(p.stats).map(([s, v]) => `${s} ${v.base} (+${v.exp.toFixed(1)})`).join(', '));
  }
} catch (err) {
  console.error(`Sim failed: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}

function secs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function moveName(data: BattleData, move: string): string {
  return data.lines.pick(() => 0, `move_name_${move}`)?.text ?? move;
}

function print(data: BattleData, clock: number, e: BattleEvent): void {
  const t = `[${secs(clock)}]`;
  switch (e.type) {
    case 'use':
      return console.log(`${t} ${e.actor} uses ${moveName(data, e.move)} on ${e.targets.join(', ')}`);
    case 'damage':
      return console.log(`${t}   ${e.target} takes ${e.amount}${e.outcome === 'crit' ? ' (critical)' : ''}`);
    case 'heal':
      return console.log(`${t}   ${e.target} recovers ${e.amount}`);
    case 'miss':
      return console.log(`${t}   ${e.actor} misses ${e.target}`);
    case 'line':
      return console.log(`${t}   ${e.entity}: "${e.text}"`);
    case 'tier':
      return console.log(`${t}   ${e.entity} ${e.resource} -> tier ${e.tier}`);
    case 'status':
      return console.log(`${t}   ${e.entity} ${e.status} ${e.phase}`);
    case 'interrupt':
      return console.log(`${t}   ${e.entity}'s ${moveName(data, e.move)} is interrupted`);
    case 'counter':
      return console.log(`${t}   ${e.entity} counters ${e.target} with ${moveName(data, e.move)}!`);
    case 'learned':
      return console.log(`${t}   ${e.entity} learns ${moveName(data, e.move)}`);
    case 'downed':
      return console.log(`${t}   ${e.entity} goes down`);
    case 'end':
      return console.log(`${t} battle over, winner: ${e.winner}`);
  }
}
