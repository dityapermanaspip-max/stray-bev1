import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { findRingProblems, ringConfig } from '../config/world_config.ts';
import { loadRecipes } from '../data/economy_repo.ts';
import { loadFieldData } from '../data/field_repo.ts';
import { loadItemCatalog } from '../data/item_repo.ts';
import { findFieldProblems } from '../field/parse.ts';
import { EPIPHANY_PREFIX, UNLOCK_KINDS } from '../growth/unlocks.ts';
import { LOAD_TIERS } from '../inventory/bag.ts';
import { LOOT_LINE_KEYS } from '../inventory/butcher.ts';
import { createPool } from './pool.ts';
import {
  findArrivalProblems,
  findBattleProblems,
  findCraftProblems,
  findTownLineProblems,
  findBodyTierProblems,
  findItemProblems,
  findLineProblems,
  findLootProblems,
  findMoveProblems,
  findNumberProblems,
  findUnlockProblems,
  knownGrowthTags,
  NAME_PREFIX,
  type LineGroup,
  type MoveInfo,
} from './startup_check.ts';

const GENERIC_SPEAKER = 'generic';

async function readConfig(pool: pg.Pool): Promise<Map<string, unknown>> {
  const res = await pool.query<{ config_key: string; value: unknown }>(
    'SELECT config_key, value FROM config.balance_config',
  );
  return new Map(res.rows.map((r) => [r.config_key, r.value]));
}

// Returns every problem found. Empty means the server may start.
export async function runStartupCheck(pool: pg.Pool): Promise<string[]> {
  const config = await readConfig(pool);
  const minLines = config.get('diegetic_min_lines');
  const bodyTiers = config.get('body_tiers');
  if (typeof minLines !== 'number') return ['balance_config diegetic_min_lines is missing'];
  if (!bodyTiers || typeof bodyTiers !== 'object') return ['balance_config body_tiers is missing'];

  const groups = await pool.query<LineGroup>(
    `SELECT l.condition_key, l.tier, s.speaker_name AS speaker, count(*)::int AS count
     FROM presentation.diegetic_lines l
     JOIN presentation.speakers s ON s.id = l.speaker_id
     WHERE l.personality_tag IS NULL
     GROUP BY l.condition_key, l.tier, s.speaker_name, l.locale`,
  );
  const lines = await pool.query<{ condition_key: string; text: string }>(
    'SELECT condition_key, text FROM presentation.diegetic_lines',
  );
  const moves = await pool.query<MoveInfo>(
    `SELECT m.move_name, coalesce(array_agg(t.tag) FILTER (WHERE t.tag IS NOT NULL), '{}') AS tags
     FROM moves.moves m
     LEFT JOIN moves.move_tags t ON t.move_id = m.id
     GROUP BY m.move_name`,
  );

  const answers = await pool.query<{ question_key: string; answer_key: string }>(
    'SELECT question_key, answer_key FROM config.arrival_answers ORDER BY question_position, answer_position',
  );
  const unlocks = await pool.query<{ move_name: string; kind: string }>(
    'SELECT m.move_name, u.kind FROM moves.move_unlocks u JOIN moves.moves m ON m.id = u.move_id',
  );
  const arrival = config.get('arrival') as { answers_per_question?: number } | undefined;

  const catalog = await loadItemCatalog(pool);
  const gearSlots = config.get('gear_slots');
  const rot = config.get('carcass_rot') as { hours?: number[] } | undefined;
  const butchery = config.get('butchery') as { move?: string } | undefined;
  const coins = Object.keys((config.get('coin_values') as Record<string, number> | undefined) ?? {});
  const moveNames = new Set(moves.rows.map((m) => m.move_name));
  const fields = await loadFieldData(pool);
  const species = await pool.query<{ species_name: string; base_stats: Record<string, number>; ring_min: number; ring_max: number }>(
    'SELECT species_name, base_stats, ring_min, ring_max FROM entity.species',
  );
  const rings = config.get('world.rings');
  const fieldRefs = await pool.query<{ what: string; template: string; biome: string | null }>(
    `SELECT format('hex %s,%s', q, r) AS what, field_template AS template, biome FROM world.hexes
     UNION ALL SELECT format('corridor %s', id), template, NULL FROM world.corridors`,
  );

  const lineKeys = new Set(groups.rows.map((g) => g.condition_key));
  const tierKeys = new Set(groups.rows.filter((g) => g.speaker === GENERIC_SPEAKER).map((g) => `${g.condition_key}|${g.tier}`));
  const nameKeys = new Set([...lineKeys].filter((k) => k.startsWith(NAME_PREFIX)));
  return [
    ...(typeof arrival?.answers_per_question === 'number'
      ? findArrivalProblems(answers.rows, lineKeys, arrival.answers_per_question)
      : ['balance_config arrival.answers_per_question is missing']),
    ...findLineProblems(groups.rows, minLines),
    ...findBodyTierProblems(bodyTiers as Record<string, number[]>, groups.rows, GENERIC_SPEAKER),
    ...findNumberProblems(lines.rows),
    ...findMoveProblems(moves.rows, knownGrowthTags([...config.keys()]), nameKeys),
    ...findUnlockProblems(unlocks.rows, UNLOCK_KINDS, lineKeys, EPIPHANY_PREFIX),
    ...(Array.isArray(gearSlots)
      ? findItemProblems([...catalog.values()], gearSlots, lineKeys, moveNames, LOAD_TIERS, tierKeys)
      : ['balance_config gear_slots is missing']),
    ...(Array.isArray(rot?.hours) && typeof butchery?.move === 'string'
      ? findLootProblems([...catalog.values()], LOOT_LINE_KEYS, lineKeys, tierKeys, rot.hours.length + 1, coins, moveNames, butchery.move)
      : ['balance_config carcass_rot or butchery is missing']),
    ...findFieldProblems([...fields.templates.values()], [...fields.biomes.values()]),
    ...findTownLineProblems([...fields.templates.values()].flatMap((t) => t.town?.buildings.map((b) => b.service) ?? []), lineKeys),
    ...findCraftProblems(await loadRecipes(pool), new Set(catalog.keys()), lineKeys),
    ...(rings
      ? findRingProblems(ringConfig(rings as Parameters<typeof ringConfig>[0]), species.rows.map((s) => ({
        name: s.species_name, total: Object.values(s.base_stats).reduce((n, v) => n + v, 0), ringMin: s.ring_min, ringMax: s.ring_max,
      })))
      : ['balance_config world.rings is missing']),
    ...findBattleProblems(species.rows.map((r) => r.species_name), bodyTiers as Record<string, number[]>, lineKeys, tierKeys),
    ...fieldRefs.rows.flatMap((f) => [
      ...(fields.templates.has(f.template) ? [] : [`${f.what}: unknown field template ${f.template}`]),
      ...(f.what.startsWith('corridor') || fields.biomes.has(f.biome ?? '') ? [] : [`${f.what}: unknown or missing biome ${f.biome}`]),
    ]),
  ];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pool = createPool();
  try {
    const problems = await runStartupCheck(pool);
    if (problems.length > 0) {
      console.error(`Startup check failed (${problems.length}):\n  ${problems.join('\n  ')}`);
      process.exitCode = 1;
    } else {
      console.log('Startup check passed.');
    }
  } catch (err) {
    console.error(`Startup check error: ${(err as Error).message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
