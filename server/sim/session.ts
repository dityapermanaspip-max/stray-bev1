import { parseArgs } from 'node:util';
import { createPool } from '../db/pool.ts';
import { loadBattleData, loadRaces, loadSpecies } from '../data/species_repo.ts';
import { runSession } from './session_run.ts';

// Early-game pacing sim (CLI). Reports waiting share and when growth milestones land.
// npm run session -- --fights 40 --enemies chicken,lizard,cat --corrupted-share 0.5 --seed 1

const { values } = parseArgs({
  options: {
    fights: { type: 'string', default: '40' },
    enemies: { type: 'string', default: 'chicken,lizard,cat' },
    'corrupted-share': { type: 'string', default: '0.5' },
    'low-hp-tier': { type: 'string', default: '2' },
    seed: { type: 'string', default: '1' },
  },
});

const pool = createPool();
try {
  const data = await loadBattleData(pool);
  const [species, races] = await Promise.all([loadSpecies(pool), loadRaces(pool)]);
  const r = runSession({ data, species, races }, {
    fights: Number(values.fights),
    enemies: values.enemies!.split(','),
    corruptedShare: Number(values['corrupted-share']),
    lowHpTier: Number(values['low-hp-tier']),
    seed: Number(values.seed),
    start: null,
  });

  const total = r.fightMs + r.sitMs;
  const min = (ms: number) => `${(ms / 60000).toFixed(1)} min`;
  console.log(`Fights: ${r.wins} won, ${r.passedOut} passed out, ${r.lowHpStops} low-HP stops (potion or town)`);
  console.log(`Time: ${min(total)} total, fighting ${min(r.fightMs)}, sitting ${min(r.sitMs)} (${((r.sitMs / total) * 100).toFixed(1)}% waiting)`);
  console.log('Milestones:');
  for (const m of r.milestones) console.log(`  ${m.label}: fight ${m.fight}, ${min(m.atMs)}`);
  console.log('[debug] moves:', r.moves.map((m) => `${m.name} L${m.level}`).join(', '));
  console.log('[debug] stats:', Object.entries(r.stats).map(([s, v]) => `${s} ${v}`).join(', '));
} catch (err) {
  console.error(`Session sim failed: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
