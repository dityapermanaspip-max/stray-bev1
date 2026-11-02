import type pg from 'pg';

// A move as one editable JSON draft (admin lab): the moves row and every table that points at it by foreign key.
//   Definition: move_effects, move_requires, move_unlocks, move_stat_exp, move_interrupts, move_tags.
//   Content links: species_moves (creatures that use it), recipe_requires (recipes that need it as a skill).
//   Dev only: teach (known_moves for named dev players). known_recipes and loadouts stay per-player.
//   Lines: move_name_<name> (exactly one) and use.sig.<name>.<moment> pools (at least 6 each, no numbers).
// Names, not ids: damage types, effect types, species, recipes and players are looked up by name on save.

export const LINE_MOMENTS = ['crit', 'kill', 'miss', 'cast', 'counter'] as const;
export type LineMoment = (typeof LINE_MOMENTS)[number];

export type MoveDraft = {
  move: {
    name: string; category: string; damage_type: string | null; element: string | null; resource: string | null; cost: number;
    target: string; row_rule: string; windup: number; recovery: number; channel: boolean; exp_scaling: number | null;
    cooldown_seconds: number | null; damage_per_level: number | null; recovery_per_level: number | null; cost_per_level: number | null;
  };
  effects: { type: string; power: number; duration_turns: number | null; chance: number; params: Record<string, unknown> }[];
  requires: { kind: string; value: string; amount: number | null }[];
  unlocks: { group: string; kind: string; params: Record<string, unknown> }[];
  stat_exp: Record<string, number>;
  interrupts: { gives: string[]; broken_by: string[] };
  tags: string[];
  species: string[];
  recipe_requires: { recipe: string; min_level: number }[];
  teach: string[];
  lines: { name: string } & Partial<Record<LineMoment, (string | { text: string; expression: string })[]>>;
};

export function blankDraft(): MoveDraft {
  return {
    move: {
      name: 'new_move', category: 'attack', damage_type: 'blunt', element: null, resource: 'stamina', cost: 2, target: 'one_enemy',
      row_rule: 'front', windup: 0.1, recovery: 1, channel: false, exp_scaling: 1, cooldown_seconds: null,
      damage_per_level: null, recovery_per_level: null, cost_per_level: null,
    },
    effects: [{ type: 'damage', power: 5, duration_turns: null, chance: 1, params: {} }],
    requires: [], unlocks: [], stat_exp: { str: 1 }, interrupts: { gives: [], broken_by: [] }, tags: [],
    species: [], recipe_requires: [], teach: [], lines: { name: 'New Move' },
  };
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

// An existing move as a draft (a starting point, or an example for the AI). Null when unknown.
export async function exportMove(pool: pg.Pool, name: string): Promise<MoveDraft | null> {
  const m = (await pool.query(
    `SELECT m.*, d.damage_type_name FROM moves.moves m LEFT JOIN moves.damage_types d ON d.id = m.damage_type_id WHERE m.move_name = $1`, [name],
  )).rows[0];
  if (!m) return null;
  const q = async (sql: string) => (await pool.query(sql, [m.id])).rows;
  const [effects, requires, unlocks, statExp, interrupts, tags, species, recipes, lines] = await Promise.all([
    q(`SELECT e.effect_name, me.power, me.duration_turns, me.chance, me.params FROM moves.move_effects me
       JOIN moves.effect_types e ON e.id = me.effect_type_id WHERE me.move_id = $1 ORDER BY me.position`),
    q('SELECT kind, value, amount FROM moves.move_requires WHERE move_id = $1 ORDER BY kind, value'),
    q('SELECT option_group, kind, params FROM moves.move_unlocks WHERE move_id = $1 ORDER BY option_group, kind'),
    q('SELECT stat, amount FROM moves.move_stat_exp WHERE move_id = $1 ORDER BY stat'),
    q('SELECT role, tag FROM moves.move_interrupts WHERE move_id = $1 ORDER BY role, tag'),
    q('SELECT tag FROM moves.move_tags WHERE move_id = $1 ORDER BY tag'),
    q('SELECT s.species_name FROM entity.species_moves sm JOIN entity.species s ON s.id = sm.species_id WHERE sm.move_id = $1 ORDER BY 1'),
    q('SELECT r.recipe_name, rr.min_skill_level FROM item.recipe_requires rr JOIN item.recipes r ON r.id = rr.recipe_id WHERE rr.skill_move_id = $1'),
    pool.query(
      `SELECT l.condition_key, l.expression, l.text FROM presentation.diegetic_lines l JOIN presentation.speakers s ON s.id = l.speaker_id
       WHERE s.speaker_name = 'generic' AND (l.condition_key = 'move_name_' || $1 OR l.condition_key LIKE 'use.sig.' || $1 || '.%')
       ORDER BY l.condition_key, l.text`, [name],
    ).then((r) => r.rows),
  ]);
  const draftLines: MoveDraft['lines'] = { name: lines.find((l) => l.condition_key === `move_name_${name}`)?.text ?? name };
  for (const moment of LINE_MOMENTS) {
    const pool_ = lines.filter((l) => l.condition_key === `use.sig.${name}.${moment}`).map((l) => ({ text: l.text, expression: l.expression }));
    if (pool_.length > 0) draftLines[moment] = pool_;
  }
  return {
    move: {
      name: m.move_name, category: m.category, damage_type: m.damage_type_name, element: m.element, resource: m.resource, cost: Number(m.cost),
      target: m.target, row_rule: m.row_rule, windup: Number(m.atb_windup), recovery: Number(m.atb_recovery), channel: m.channel,
      exp_scaling: num(m.exp_scaling), cooldown_seconds: num(m.cooldown_seconds), damage_per_level: num(m.damage_per_level),
      recovery_per_level: num(m.recovery_per_level), cost_per_level: num(m.cost_per_level),
    },
    effects: effects.map((e) => ({ type: e.effect_name, power: Number(e.power), duration_turns: e.duration_turns, chance: Number(e.chance), params: e.params })),
    requires: requires.map((r) => ({ kind: r.kind, value: r.value, amount: num(r.amount) })),
    unlocks: unlocks.map((u) => ({ group: u.option_group, kind: u.kind, params: u.params })),
    stat_exp: Object.fromEntries(statExp.map((s) => [s.stat, Number(s.amount)])),
    interrupts: {
      gives: interrupts.filter((i) => i.role === 'gives').map((i) => i.tag),
      broken_by: interrupts.filter((i) => i.role === 'broken_by').map((i) => i.tag),
    },
    tags: tags.map((t) => t.tag),
    species: species.map((s) => s.species_name),
    recipe_requires: recipes.map((r) => ({ recipe: r.recipe_name, min_level: r.min_skill_level })),
    teach: [],
    lines: draftLines,
  };
}

// What the editor and the AI may pick from: names that exist in the DB, plus one sample params object per effect type.
export type MoveReference = {
  moves: string[]; effectTypes: { name: string; sample: Record<string, unknown> | null }[]; damageTypes: string[]; tags: string[];
  species: string[]; recipes: string[]; bodyParts: string[]; interruptTags: string[];
};

export async function moveReference(pool: pg.Pool): Promise<MoveReference> {
  const col = async (sql: string) => (await pool.query(sql)).rows.map((r) => r.v);
  const [moves, damageTypes, tags, species, recipes, bodyParts, interruptTags, effects] = await Promise.all([
    col('SELECT move_name AS v FROM moves.moves ORDER BY 1'),
    col('SELECT damage_type_name AS v FROM moves.damage_types ORDER BY 1'),
    col('SELECT DISTINCT tag AS v FROM moves.move_tags ORDER BY 1'),
    col('SELECT species_name AS v FROM entity.species ORDER BY 1'),
    col('SELECT recipe_name AS v FROM item.recipes ORDER BY 1'),
    col('SELECT DISTINCT unnest(body_parts) AS v FROM entity.races ORDER BY 1'),
    col('SELECT DISTINCT tag AS v FROM moves.move_interrupts ORDER BY 1'),
    pool.query(`SELECT e.effect_name, (SELECT me.params FROM moves.move_effects me WHERE me.effect_type_id = e.id
                  ORDER BY jsonb_array_length(jsonb_path_query_array(me.params, '$.keyvalue()')) DESC LIMIT 1) AS sample
                FROM moves.effect_types e ORDER BY 1`).then((r) => r.rows),
  ]);
  return {
    moves, damageTypes, tags, species, recipes, bodyParts, interruptTags,
    effectTypes: effects.map((e) => ({ name: e.effect_name, sample: e.sample ?? null })),
  };
}
