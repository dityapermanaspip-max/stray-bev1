import { parseArgs } from 'node:util';
import { loadBalance } from '../config/balance.ts';
import { loadLinks, devRoundId } from '../data/field_repo.ts';
import { loadPopulation } from '../data/population_repo.ts';
import { createPool } from '../db/pool.ts';
import { blendRows, density, encounterPermille, groupLimit } from '../world/encounter.ts';
import { simulate, type PopRow } from '../world/population.ts';

// Dev report: the dev world's fields left alone for N days (world tick rules on counts), and what that
// does to encounters. Reads config and populations from the DB, writes nothing.
// npm run sim:world -- --days 10 [--luck 5] [--steps 20]

const { values } = parseArgs({ options: { days: { type: 'string', default: '10' }, luck: { type: 'string' }, steps: { type: 'string', default: '20' } } });
const pool = createPool();
const cfg = await loadBalance(pool);
const roundId = await devRoundId(pool);
if (!roundId) throw new Error('no dev round: run npm run db:seed');
const links = await loadLinks(pool, roundId);
const hexes = [...links.hexes.values()];
const start = await loadPopulation(pool, hexes.map((h) => h.id));
await pool.end();

const days = Number(values.days);
const luck = Number(values.luck ?? cfg.playerStartStats.luck ?? 0);
const steps = Number(values.steps);
const runs = new Map(hexes.map((h) => [h.id, simulate(cfg.ticks, cfg.worldTimeScale, start.get(h.id)!, days)]));

const pct = (v: number) => `${Math.round(v * 100)}%`;
function encounterCells(rows: PopRow[]): string[] {
  const p = encounterPermille(cfg.encounter, cfg.luck, rows, luck);
  const perCrossing = 1 - (1 - p / 1000) ** Math.max(0, steps - cfg.encounter.graceSteps);
  return [pct(density(rows)), `${p}‰`, p > 0 ? `1 in ${Math.round(1000 / p)}` : 'never', pct(perCrossing), `1-${groupLimit(cfg.encounter, rows)}`];
}
const counts = (rows: PopRow[]) => rows.map((r) => `${r.species} ${r.natives}+${r.corrupted}c`).join(', ');

console.log(`Leader luck ${luck}; a crossing = ${steps} steps, the first ${cfg.encounter.graceSteps} are quiet.`);
console.log('columns: day | creatures (natives+corrupted) | density | chance per step | steps per encounter | chance per crossing | group size\n');
for (const h of hexes) {
  console.log(`hex ${h.q},${h.r}`);
  const table = [start.get(h.id)!, ...runs.get(h.id)!].map((rows, day) => ({ day, creatures: counts(rows), ...Object.fromEntries(
    ['density', 'per step', 'steps/enc', 'per crossing', 'group'].map((k, i) => [k, encounterCells(rows)[i]]),
  ) }));
  console.table(table);
}
for (const border of links.borders) {
  const label = (rows: PopRow[]) => encounterCells(rows).join(' | ');
  border.corridors.forEach((ref, i) => {
    const share = (i + 0.5) / border.corridors.length;
    const at = (day: number) => blendRows(
      day === 0 ? start.get(border.a.id)! : runs.get(border.a.id)![day - 1],
      day === 0 ? start.get(border.b.id)! : runs.get(border.b.id)![day - 1], share,
    );
    console.log(`corridor ${i + 1} of ${border.corridors.length}: day 0 ${label(at(0))}  ->  day ${days} ${label(at(days))}`);
  });
}
