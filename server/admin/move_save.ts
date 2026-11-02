import type pg from 'pg';
import { HANDLERS } from '../battle/effects/registry.ts';
import { loadBattleData } from '../data/species_repo.ts';
import { runStartupCheck } from '../db/check.ts';
import { LINE_MOMENTS, type MoveDraft } from './move_draft.ts';

// Saving a move from the admin lab: every row of the draft in one transaction, then the full startup check
// and the battle data loader run inside that same transaction. Only problems the draft adds count (the check is
// compared with the database before). Check mode always rolls back; save commits only when nothing is wrong.
// Create makes a new move; update rewrites an existing one (found by move.name, same id, so known moves and
// loadouts keep pointing at it): its row is updated and every linked row of the draft is replaced.

const NAME = /^[a-z][a-z0-9_]{1,40}$/;
const MOMENT_EXPRESSION: Record<string, string> = { crit: 'fierce', kill: 'grim', miss: 'frustrated', cast: 'focused', counter: 'determined' };

export type SaveResult = { saved: boolean; problems: string[] };

function shapeProblems(d: MoveDraft): string[] {
  const p: string[] = [];
  if (!d || typeof d !== 'object' || !d.move) return ['draft needs a "move" object'];
  if (!NAME.test(String(d.move.name ?? ''))) p.push('move.name: lowercase letters, digits and _ (2-41 chars)');
  for (const k of ['effects', 'requires', 'unlocks', 'tags', 'species', 'recipe_requires', 'teach'] as const) {
    if (d[k] !== undefined && !Array.isArray(d[k])) p.push(`${k} must be a list`);
  }
  if (!d.lines || typeof d.lines.name !== 'string' || !d.lines.name.trim()) p.push('lines.name: the display name is required');
  for (const key of Object.keys(d.lines ?? {})) {
    if (key !== 'name' && !(LINE_MOMENTS as readonly string[]).includes(key)) p.push(`lines.${key}: unknown moment (use ${LINE_MOMENTS.join(', ')})`);
  }
  return p;
}

// Runs a statement that inserts one row per name found; reports the names it could not find.
export async function linked(c: pg.PoolClient, what: string, names: string[], sql: string, args: unknown[]): Promise<string[]> {
  if (names.length === 0) return [];
  const found = (await c.query<{ name: string }>(sql, args)).rows.map((r) => r.name);
  return names.filter((n) => !found.includes(n)).map((n) => `${what} ${n}: not found`);
}

const COLUMNS = `move_name, category, damage_type_id, element, resource, cost, target, row_rule, atb_windup, atb_recovery,
  channel, exp_scaling, cooldown_seconds, damage_per_level, recovery_per_level, cost_per_level`;
const VALUES = `$1, $2, (SELECT id FROM moves.damage_types WHERE damage_type_name = $3), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16`;

// The moves row (inserted, or updated in place) and its id; then every linked row is cleared and written again.
async function writeDraft(c: pg.PoolClient, d: MoveDraft, update: boolean): Promise<string[]> {
  const m = d.move;
  const problems: string[] = [];
  const old = (await c.query<{ id: string }>('SELECT id FROM moves.moves WHERE move_name = $1', [m.name])).rows[0]?.id;
  if (old && !update) return [`move ${m.name} already exists (load it to edit, or pick a new name)`];
  if (!old && update) return [`move ${m.name} does not exist (nothing to update; save it as new)`];
  if (m.damage_type && !(await c.query('SELECT 1 FROM moves.damage_types WHERE damage_type_name = $1', [m.damage_type])).rowCount) {
    problems.push(`damage type ${m.damage_type}: not found`);
  }
  const args = [m.name, m.category, m.damage_type, m.element, m.resource, m.cost, m.target, m.row_rule, m.windup, m.recovery, m.channel === true,
    m.exp_scaling, m.cooldown_seconds, m.damage_per_level, m.recovery_per_level, m.cost_per_level];
  const id = old
    ? (await c.query<{ id: string }>(`UPDATE moves.moves SET (${COLUMNS}) = ROW(${VALUES}) WHERE id = $17 RETURNING id`, [...args, old])).rows[0].id
    : (await c.query<{ id: string }>(`INSERT INTO moves.moves (${COLUMNS}) VALUES (${VALUES}) RETURNING id`, args)).rows[0].id;
  if (old) {
    for (const t of ['move_effects', 'move_requires', 'move_unlocks', 'move_stat_exp', 'move_interrupts', 'move_tags']) {
      await c.query(`DELETE FROM moves.${t} WHERE move_id = $1`, [id]);
    }
    await c.query('DELETE FROM entity.species_moves WHERE move_id = $1', [id]);
    await c.query('DELETE FROM item.recipe_requires WHERE skill_move_id = $1', [id]);
    await c.query(
      `DELETE FROM presentation.diegetic_lines l USING presentation.speakers s WHERE s.id = l.speaker_id AND s.speaker_name = 'generic'
       AND (l.condition_key = 'move_name_' || $1 OR l.condition_key LIKE 'use.sig.' || $1 || '.%')`, [m.name],
    );
  }

  const effects = d.effects ?? [];
  problems.push(...await linked(c, 'effect type', [...new Set(effects.map((e) => e.type))],
    `INSERT INTO moves.move_effects (move_id, position, effect_type_id, power, duration_turns, chance, params)
     SELECT $1, x.pos, t.id, x.power, x.dur, x.chance, x.params FROM unnest($2::int[], $3::text[], $4::numeric[], $5::int[], $6::numeric[], $7::jsonb[])
       AS x(pos, type, power, dur, chance, params) JOIN moves.effect_types t ON t.effect_name = x.type
     RETURNING (SELECT effect_name FROM moves.effect_types WHERE id = effect_type_id) AS name`,
    [id, effects.map((_, i) => i + 1), effects.map((e) => e.type), effects.map((e) => e.power ?? 0), effects.map((e) => e.duration_turns ?? null),
      effects.map((e) => e.chance ?? 1), effects.map((e) => JSON.stringify(e.params ?? {}))]));
  for (const r of d.requires ?? []) {
    await c.query('INSERT INTO moves.move_requires (move_id, kind, value, amount) VALUES ($1, $2, $3, $4)', [id, r.kind, String(r.value), r.amount ?? null]);
  }
  for (const u of d.unlocks ?? []) {
    await c.query('INSERT INTO moves.move_unlocks (move_id, option_group, kind, params) VALUES ($1, $2, $3, $4)', [id, String(u.group ?? 'a'), u.kind, JSON.stringify(u.params ?? {})]);
  }
  for (const [stat, amount] of Object.entries(d.stat_exp ?? {})) {
    await c.query('INSERT INTO moves.move_stat_exp (move_id, stat, amount) VALUES ($1, $2, $3)', [id, stat, amount]);
  }
  for (const role of ['gives', 'broken_by'] as const) {
    for (const tag of new Set(d.interrupts?.[role] ?? [])) await c.query('INSERT INTO moves.move_interrupts (move_id, role, tag) VALUES ($1, $2, $3)', [id, role, tag]);
  }
  for (const tag of new Set(d.tags ?? [])) await c.query('INSERT INTO moves.move_tags (move_id, tag) VALUES ($1, $2)', [id, tag]);
  problems.push(...await linked(c, 'species', d.species ?? [],
    `INSERT INTO entity.species_moves (species_id, move_id) SELECT s.id, $1 FROM entity.species s WHERE s.species_name = ANY($2)
     RETURNING (SELECT species_name FROM entity.species WHERE id = species_id) AS name`, [id, d.species ?? []]));
  const recipes = d.recipe_requires ?? [];
  problems.push(...await linked(c, 'recipe', recipes.map((r) => r.recipe),
    `INSERT INTO item.recipe_requires (recipe_id, skill_move_id, min_skill_level)
     SELECT r.id, $1, x.lvl FROM unnest($2::text[], $3::int[]) AS x(name, lvl) JOIN item.recipes r ON r.recipe_name = x.name
     RETURNING (SELECT recipe_name FROM item.recipes WHERE id = recipe_id) AS name`, [id, recipes.map((r) => r.recipe), recipes.map((r) => r.min_level ?? 1)]));
  problems.push(...await linked(c, 'player', d.teach ?? [],
    `INSERT INTO entity.known_moves (entity_id, move_id) SELECT e.id, $1 FROM entity.entities e WHERE e.kind = 'player' AND e.name = ANY($2) AND e.alive
     ON CONFLICT DO NOTHING RETURNING (SELECT name FROM entity.entities WHERE id = entity_id) AS name`, [id, d.teach ?? []]));

  const rows: [string, string, string][] = [[`move_name_${m.name}`, 'neutral', d.lines.name.trim()]];
  for (const moment of LINE_MOMENTS) {
    for (const line of d.lines[moment] ?? []) {
      const { text, expression } = typeof line === 'string' ? { text: line, expression: MOMENT_EXPRESSION[moment] } : line;
      rows.push([`use.sig.${m.name}.${moment}`, expression || MOMENT_EXPRESSION[moment], String(text).trim()]);
    }
  }
  await c.query(
    `INSERT INTO presentation.diegetic_lines (condition_key, tier, speaker_id, expression, text)
     SELECT x.k, 0, s.id, x.e, x.t FROM unnest($1::text[], $2::text[], $3::text[]) AS x(k, e, t)
     JOIN presentation.speakers s ON s.speaker_name = 'generic' ON CONFLICT DO NOTHING`,
    [rows.map((r) => r[0]), rows.map((r) => r[1]), rows.map((r) => r[2])],
  );
  return problems;
}

// Runs `write` in one transaction, then the full startup check and `verify` inside it. Only startup problems the
// write adds count. Commits only when asked and clean; otherwise rolls back (check mode never keeps anything).
export async function checkedWrite(
  pool: pg.Pool, commit: boolean, write: (c: pg.PoolClient) => Promise<string[]>, verify: (db: pg.Pool) => Promise<string[]>,
): Promise<SaveResult> {
  const before = new Set(await runStartupCheck(pool));
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const problems = await write(c);
    const db = c as unknown as pg.Pool; // the checks only query: run them inside this transaction
    problems.push(...(await runStartupCheck(db)).filter((p) => !before.has(p)), ...(await verify(db)));
    const saved = commit && problems.length === 0;
    await c.query(saved ? 'COMMIT' : 'ROLLBACK');
    return { saved, problems };
  } catch (err) {
    await c.query('ROLLBACK');
    return { saved: false, problems: [(err as Error).message] };
  } finally {
    c.release();
  }
}

export async function saveMove(pool: pg.Pool, draft: MoveDraft, commit: boolean, update = false): Promise<SaveResult> {
  const shape = shapeProblems(draft);
  if (shape.length > 0) return { saved: false, problems: shape };
  return checkedWrite(pool, commit, (c) => writeDraft(c, draft, update), async (db) => {
    const parsed = (await loadBattleData(db)).moves.get(draft.move.name);
    if (!parsed) return ['the battle data loader did not find the move'];
    return parsed.effects.filter((e) => !HANDLERS[e.handler]).map((e) => `effect handler ${e.handler}: not built`);
  });
}
