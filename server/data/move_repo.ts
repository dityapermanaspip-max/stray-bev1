import type pg from 'pg';
import type { Stat } from '../stats/derived.ts';
import type { MoveDef, Resource, StatusDef, TargetRule } from '../battle/types.ts';
import type { UnlockRule } from '../growth/unlocks.ts';

// Loads move data tables into memory. The database stays the source of truth.

const n = (v: unknown): number => Number(v);
const nOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const GROWTH_PREFIX = 'growth.';

type MoveRow = {
  id: string;
  move_name: string;
  category: string;
  damage_type_name: string | null;
  damage_kind: 'physical' | 'magic' | null;
  element: string | null;
  resource: Resource | null;
  cost: string;
  target: TargetRule;
  row_rule: string;
  atb_windup: string;
  atb_recovery: string;
  cooldown_seconds: string | null;
  channel: boolean;
  exp_scaling: string | null;
  damage_per_level: string | null;
  recovery_per_level: string | null;
  cost_per_level: string | null;
};

export async function loadMoves(pool: pg.Pool): Promise<Map<string, MoveDef>> {
  const [moves, effects, requires, statExp, interrupts, tags] = await Promise.all([
    pool.query<MoveRow>(
      `SELECT m.*, d.damage_type_name, d.kind AS damage_kind
       FROM moves.moves m LEFT JOIN moves.damage_types d ON d.id = m.damage_type_id`,
    ),
    pool.query(
      `SELECT me.move_id, e.handler_key, me.power, me.duration_turns, me.chance, me.params
       FROM moves.move_effects me JOIN moves.effect_types e ON e.id = me.effect_type_id
       ORDER BY me.move_id, me.position`,
    ),
    pool.query('SELECT move_id, kind, value, amount FROM moves.move_requires'),
    pool.query('SELECT move_id, stat, amount FROM moves.move_stat_exp'),
    pool.query('SELECT move_id, role, tag FROM moves.move_interrupts'),
    pool.query('SELECT move_id, tag FROM moves.move_tags'),
  ]);

  const byId = new Map<string, MoveDef>();
  for (const m of moves.rows) {
    byId.set(m.id, {
      name: m.move_name,
      category: m.category,
      damageType: m.damage_type_name,
      damageKind: m.damage_kind,
      element: m.element,
      resource: m.resource,
      cost: n(m.cost),
      target: m.target,
      rowRule: m.row_rule,
      windup: n(m.atb_windup),
      recovery: n(m.atb_recovery),
      cooldown: nOrNull(m.cooldown_seconds),
      channel: m.channel,
      expScaling: m.exp_scaling === null ? 1 : n(m.exp_scaling),
      overrides: {
        damage: nOrNull(m.damage_per_level),
        recovery: nOrNull(m.recovery_per_level),
        cost: nOrNull(m.cost_per_level),
      },
      growthTag: '',
      tags: [],
      effects: [],
      requires: [],
      statExp: {},
      gives: [],
      brokenBy: [],
    });
  }

  for (const r of effects.rows) {
    byId.get(r.move_id)?.effects.push({
      handler: r.handler_key,
      power: n(r.power),
      durationTurns: nOrNull(r.duration_turns),
      chance: n(r.chance),
      params: r.params ?? {},
    });
  }
  for (const r of requires.rows) {
    byId.get(r.move_id)?.requires.push({ kind: r.kind, value: r.value, amount: nOrNull(r.amount) });
  }
  for (const r of statExp.rows) {
    const move = byId.get(r.move_id);
    if (move) move.statExp[r.stat as Stat] = n(r.amount);
  }
  for (const r of interrupts.rows) {
    const move = byId.get(r.move_id);
    if (move) (r.role === 'gives' ? move.gives : move.brokenBy).push(r.tag);
  }
  for (const r of tags.rows) {
    const move = byId.get(r.move_id);
    if (!move) continue;
    move.tags.push(r.tag);
    if (r.tag.startsWith(GROWTH_PREFIX)) move.growthTag = r.tag.slice(GROWTH_PREFIX.length);
  }

  return new Map([...byId.values()].map((m) => [m.name, m]));
}

export async function loadStatuses(pool: pg.Pool): Promise<Map<string, StatusDef>> {
  const res = await pool.query(
    `SELECT s.status_name, d.damage_type_name, s.element, s.stack_rule, s.ignores_defense, s.tick_interval
     FROM moves.status_types s LEFT JOIN moves.damage_types d ON d.id = s.damage_type_id`,
  );
  return new Map(
    res.rows.map((r) => [
      r.status_name,
      {
        name: r.status_name,
        damageType: r.damage_type_name,
        element: r.element,
        stackRule: r.stack_rule,
        ignoresDefense: r.ignores_defense,
        tickInterval: n(r.tick_interval),
      },
    ]),
  );
}

// The recipe table. Server-only: it never reaches the client.
export async function loadUnlocks(pool: pg.Pool): Promise<UnlockRule[]> {
  const res = await pool.query<{ move_name: string; option_group: string; kind: string; params: Record<string, unknown> }>(
    `SELECT m.move_name, u.option_group, u.kind, u.params
     FROM moves.move_unlocks u JOIN moves.moves m ON m.id = u.move_id`,
  );
  return res.rows.map((r) => ({ move: r.move_name, group: r.option_group, kind: r.kind, params: r.params ?? {} }));
}
