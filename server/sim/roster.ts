import { parseArgs } from 'node:util';
import { createPool } from '../db/pool.ts';
import { loadGameWorld } from '../game/world.ts';
import { poolShare, recruitThreshold } from '../recruit/recruit_rules.ts';
import { fillTown, loadRecruitData, loadRosterTowns, rollSummoner, type RecruitDeps } from '../recruit/recruit_repo.ts';
import { createRng } from '../util/rng.ts';

// Dev tool: fills every town of the current round with its full recruit roster (notables, keepers' heirs and pupils,
// the pool at its ring's share), rolls a summoner for every player who has none in this round, then prints the roster.
//   npm run world:roster -- [--seed N]
// Run again to top up only what is missing. Hidden numbers are printed here on purpose: this is a dev tool.

const { values } = parseArgs({ options: { seed: { type: 'string', default: '1' } } });
const pool = createPool();
try {
  const world = await loadGameWorld(pool);
  const { cfg, unlocks } = world.data;
  const d: RecruitDeps = { pool, cfg, catalog: world.catalog, unlocks, roundId: world.roundId, ...(await loadRecruitData(pool)) };
  const rng = createRng(Number(values.seed) >>> 0);
  const towns = await loadRosterTowns(pool, world.roundId);
  for (const town of towns) {
    const filled = await fillTown(d, town, rng);
    console.log(`town ${town.ref.slice(0, 8)} ring ${town.ring}, ${town.population} people (pool share ${poolShare(d.rc, town.ring, cfg.rings.count) * 100}%): `
      + `notables ${filled.notables.join(', ')}; added ${filled.lineage} lineage, ${filled.pool} pool`);
  }
  const players = await pool.query<{ id: string; name: string }>(
    "SELECT id, name FROM entity.entities WHERE kind = 'player' AND alive ORDER BY name",
  );
  for (const p of players.rows) if (await rollSummoner(d, p.id, rng)) console.log(`summoner rolled for ${p.name}`); // none yet in this round

  const roster = await pool.query<{ town: string; source: string; template: string; spot: string; name: string; levels: number; traits: string | null; wage: number | null; bound: string | null }>(
    `SELECT r.town_ref AS town, r.source, r.template, r.spot, e.name,
            (SELECT coalesce(sum(k.level), 0) FROM entity.known_moves k JOIN moves.moves m ON m.id = k.move_id
             WHERE k.entity_id = e.id AND m.category <> 'life')::int AS levels,
            (SELECT string_agg(t.trait_name || CASE WHEN et.params <> '{}'::jsonb THEN et.params::text ELSE '' END, ' ')
             FROM entity.entity_traits et JOIN entity.traits t ON t.id = et.trait_id WHERE et.entity_id = e.id) AS traits,
            r.wage_per_day AS wage, p.name AS bound
     FROM world.town_recruits r JOIN entity.entities e ON e.id = r.entity_id LEFT JOIN entity.entities p ON p.id = r.bound_to
     WHERE r.town_ref = ANY($1) ORDER BY r.town_ref, r.source, r.template`,
    [towns.map((t) => t.ref)],
  );
  for (const town of towns) {
    const rows = roster.rows.filter((r) => r.town === town.ref);
    console.log(`\n== town ${town.ref.slice(0, 8)} (ring ${town.ring}): ${rows.length} recruitable`);
    for (const r of rows) {
      const need = recruitThreshold(d.rc, r.levels, r.source === 'lineage');
      console.log(`  ${r.source.padEnd(8)} ${r.template.padEnd(22)} ${r.name.padEnd(8)} at ${r.spot.padEnd(15)} lv ${String(r.levels).padStart(2)}`
        + ` need ${String(need).padStart(3)}${r.wage !== null ? ` wage ${r.wage}/day` : ''}${r.bound ? ` bound to ${r.bound}` : ''}  ${r.traits ?? ''}`);
    }
  }
} finally {
  await pool.end();
}
