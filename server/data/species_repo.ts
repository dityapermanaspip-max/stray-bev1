import type pg from 'pg';
import { loadBalance } from '../config/balance.ts';
import { loadLinePicker } from '../presentation/line_picker.ts';
import type { CoreStats } from '../stats/derived.ts';
import type { BattleData } from '../battle/types.ts';
import { loadMoves, loadStatuses, loadUnlocks } from './move_repo.ts';

// Species and races for building combatants, plus the full battle data bundle.

export type SpeciesDef = {
  name: string;
  baseStats: CoreStats;
  bodyParts: string[];
  moves: string[];
  resist: Map<string, number>;
  onExpiry: 'devour' | 'ignore';
};

export type RaceDef = { name: string; bodyParts: string[] };

async function loadResistances(pool: pg.Pool, ownerKind: string): Promise<Map<string, Map<string, number>>> {
  const res = await pool.query(
    'SELECT owner_id, target_kind, target_id, mult FROM entity.resistances WHERE owner_kind = $1',
    [ownerKind],
  );
  const byOwner = new Map<string, Map<string, number>>();
  for (const r of res.rows) {
    const map = byOwner.get(r.owner_id) ?? new Map<string, number>();
    map.set(`${r.target_kind}:${r.target_id}`, Number(r.mult));
    byOwner.set(r.owner_id, map);
  }
  return byOwner;
}

export async function loadSpecies(pool: pg.Pool): Promise<Map<string, SpeciesDef>> {
  const [species, moves, resist] = await Promise.all([
    pool.query('SELECT id, species_name, base_stats, body_parts, on_expiry FROM entity.species'),
    pool.query(
      `SELECT sm.species_id, m.move_name FROM entity.species_moves sm
       JOIN moves.moves m ON m.id = sm.move_id ORDER BY m.move_name`,
    ),
    loadResistances(pool, 'species'),
  ]);
  const result = new Map<string, SpeciesDef>();
  for (const s of species.rows) {
    result.set(s.species_name, {
      name: s.species_name,
      baseStats: s.base_stats,
      bodyParts: s.body_parts,
      moves: moves.rows.filter((m) => m.species_id === s.id).map((m) => m.move_name),
      resist: resist.get(s.id) ?? new Map(),
      onExpiry: s.on_expiry,
    });
  }
  return result;
}

export async function loadRaces(pool: pg.Pool): Promise<Map<string, RaceDef>> {
  const res = await pool.query('SELECT race_name, body_parts FROM entity.races');
  return new Map(res.rows.map((r) => [r.race_name, { name: r.race_name, bodyParts: r.body_parts }]));
}

export async function loadBattleData(pool: pg.Pool): Promise<BattleData> {
  const [cfg, moves, statuses, lines, unlocks] = await Promise.all([
    loadBalance(pool),
    loadMoves(pool),
    loadStatuses(pool),
    loadLinePicker(pool),
    loadUnlocks(pool),
  ]);
  return { cfg, moves, statuses, lines, unlocks };
}
