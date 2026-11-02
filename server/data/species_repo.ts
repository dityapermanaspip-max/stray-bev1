import type pg from 'pg';
import { loadBalance } from '../config/balance.ts';
import { loadLinePicker } from '../presentation/line_picker.ts';
import type { CoreStats } from '../stats/derived.ts';
import type { BattleData } from '../battle/types.ts';
import type { UnlockRule } from '../growth/unlocks.ts';
import { loadMoves, loadStatuses, loadUnlocks } from './move_repo.ts';

// Species and races for building combatants, plus the full battle data bundle.

export type SpeciesDef = {
  name: string;
  baseStats: CoreStats; // reference only: regular creatures are rolled per ring (world/creature_roll.ts)
  mainStats: string[];
  bodyParts: string[];
  moves: string[];
  corruptedMoves?: string[]; // pool moves only a corrupted one may roll
  unlocks?: UnlockRule[]; // unlock rules of pool moves: a rolled creature only gets a move once its rules pass
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
  const [species, moves, resist, unlocks] = await Promise.all([
    pool.query('SELECT id, species_name, base_stats, main_stats, body_parts, on_expiry, variant_of FROM entity.species'),
    pool.query(
      `SELECT sm.species_id, m.move_name, sm.corrupted_only FROM entity.species_moves sm
       JOIN moves.moves m ON m.id = sm.move_id ORDER BY m.move_name`,
    ),
    loadResistances(pool, 'species'),
    loadUnlocks(pool),
  ]);
  const result = new Map<string, SpeciesDef>();
  // A variant takes what it leaves empty (move pool, main stats, body parts) from the species it is a variant of.
  const byId = new Map(species.rows.map((s) => [s.id, s]));
  const pool_ = (id: string, corrupted = false) =>
    moves.rows.filter((m) => m.species_id === id && m.corrupted_only === corrupted).map((m) => m.move_name);
  const own = <T>(mine: T[] | null, base: T[] | undefined) => (mine && mine.length > 0 ? mine : base ?? []);
  for (const s of species.rows) {
    const base = s.variant_of ? byId.get(s.variant_of) : undefined;
    result.set(s.species_name, {
      name: s.species_name,
      baseStats: s.base_stats,
      mainStats: own(s.main_stats, base?.main_stats),
      bodyParts: own(s.body_parts, base?.body_parts),
      moves: own(pool_(s.id), base ? pool_(base.id) : undefined),
      corruptedMoves: own(pool_(s.id, true), base ? pool_(base.id, true) : undefined),
      resist: resist.get(s.id) ?? new Map(),
      onExpiry: s.on_expiry,
    });
  }
  for (const def of result.values()) {
    const all = [...def.moves, ...(def.corruptedMoves ?? [])];
    def.unlocks = unlocks.filter((u) => all.includes(u.move));
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
