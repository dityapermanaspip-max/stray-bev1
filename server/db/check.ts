import path from 'node:path';
import { interiorConfig } from '../config/interior_config.ts';
import { findTileProblems } from '../tiles/tile_check.ts';
import { loadTiles } from '../tiles/tile_repo.ts';
import { findInteriorProblems } from '../interior/interior_check.ts';
import { findFormationProblems, formationConfig } from '../battle/formation.ts';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { creatureGenConfig, findCreatureGenProblems } from '../config/creature_config.ts';
import { findRingProblems, ringConfig } from '../config/world_config.ts';
import { findWorldGenProblems, worldGenConfig } from '../config/worldgen_config.ts';
import { loadRecipes } from '../data/economy_repo.ts';
import { loadFieldData } from '../data/field_repo.ts';
import { loadItemCatalog } from '../data/item_repo.ts';
import { findFieldProblems } from '../field/parse.ts';
import { EPIPHANY_PREFIX, UNLOCK_KINDS } from '../growth/unlocks.ts';
import { findTraitProblems } from '../growth/traits.ts';
import { loadTraitOptions } from '../data/entity_load.ts';
import { loadNamePools } from '../names/name_repo.ts';
import { loadRecruitData } from '../recruit/recruit_repo.ts';
import { findTemplateProblems } from '../recruit/recruit_rules.ts';
import { LOAD_TIERS } from '../inventory/bag.ts';
import { LOOT_LINE_KEYS } from '../inventory/butcher.ts';
import { findGatherProblems, gatherConfig } from '../config/gather_config.ts';
import { FOOD_LINE_KEYS } from '../food/food_service.ts';
import { GATHER_LINE_KEYS } from '../gather/gather_service.ts';
import { findViceDataProblems } from '../vice/vice_check.ts';
import { findBossProblems } from '../boss/boss_check.ts';
import { createPool } from './pool.ts';
import {
  BIOME_NAME_PREFIX,
  NODE_NAME_PREFIX,
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
  findLadderProblems,
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
  const species = await pool.query<{ species_name: string; main_stats: string[]; ring_min: number; ring_max: number }>(
    'SELECT species_name, main_stats, ring_min, ring_max FROM entity.species',
  );
  const rings = config.get('world.rings');
  const standing = config.get('standing') as { ladder?: { tiers?: number; greet_tiers?: number } } | undefined;
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
    ...findInteriorProblems(config.get('interior'), lineKeys),
    ...(config.has('interior') ? findTileProblems(await loadTiles(pool), interiorConfig(config.get('interior') as Parameters<typeof interiorConfig>[0]).rooms) : []),
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
    ...[...fields.biomes.keys()].filter((b) => !lineKeys.has(BIOME_NAME_PREFIX + b)).map((b) => `biome ${b}: no ${BIOME_NAME_PREFIX} line`),
    ...(config.has('world.gen') && rings
      ? findWorldGenProblems(worldGenConfig(config.get('world.gen') as Parameters<typeof worldGenConfig>[0]), (rings as { count: number }).count, new Set(fields.biomes.keys()))
      : ['balance_config world.gen is missing']),
    ...findTownLineProblems(
      [...fields.templates.values()].flatMap((t) => t.town?.buildings.map((b) => b.service) ?? []), lineKeys, tierKeys,
      standing?.ladder?.greet_tiers ?? 0,
    ),
    ...(typeof standing?.ladder?.tiers === 'number'
      ? findLadderProblems(standing.ladder.tiers, lineKeys, (await pool.query<{ n: string }>('SELECT DISTINCT r.race_name AS n FROM world.cultures c JOIN entity.races r ON r.id = c.race_id')).rows.map((r) => r.n), // folk with towns
        new Map([...(await loadNamePools(pool))].map(([race, p]) => [race, { male: p.male.length, female: p.female.length, last: p.last.length }])))
      : ['balance_config standing.ladder is missing']),
    ...findCraftProblems(await loadRecipes(pool), new Set(catalog.keys()), lineKeys),
    ...findTraitProblems(await loadTraitOptions(pool), lineKeys, config.get('elements')),
    ...findTemplateProblems([...(await loadRecruitData(pool)).templates.values()],
      new Map((await pool.query<{ n: string; c: string }>('SELECT move_name AS n, category AS c FROM moves.moves')).rows.map((r) => [r.n, r.c])),
      new Set(catalog.keys()), Array.isArray(gearSlots) ? gearSlots.map((s: { slot: string }) => s.slot) : [], (config.get('elements') as string[]) ?? [],
      new Set((await pool.query<{ n: string }>('SELECT race_name AS n FROM entity.races')).rows.map((r) => r.n))),
    ...(await findViceDataProblems(pool, config.get('vice'), moveNames, lineKeys)),
    ...(await findBossProblems(pool, config, moveNames, lineKeys)),
    ...[...GATHER_LINE_KEYS, ...FOOD_LINE_KEYS].filter((k) => !lineKeys.has(k)).map((k) => `${k}: no lines`),
    ...(config.has('gather') && config.has('food')
      ? [
        ...findGatherProblems(gatherConfig(config.get('gather') as Parameters<typeof gatherConfig>[0]), moveNames, new Set(await nodeTables(pool))),
        ...Object.keys((config.get('gather') as { kinds: object }).kinds).filter((k) => !lineKeys.has(NODE_NAME_PREFIX + k)).map((k) => `node ${k}: no ${NODE_NAME_PREFIX} line`),
      ]
      : ['balance_config gather or food is missing']),
    ...(rings
      ? findRingProblems(ringConfig(rings as Parameters<typeof ringConfig>[0]), species.rows.map((s) => ({ name: s.species_name, ringMin: s.ring_min, ringMax: s.ring_max })))
      : ['balance_config world.rings is missing']),
    ...(rings && config.has('creature.gen')
      ? findCreatureGenProblems(creatureGenConfig(config.get('creature.gen') as Parameters<typeof creatureGenConfig>[0]), (rings as { count: number }).count,
        species.rows.map((s) => ({ name: s.species_name, mainStats: s.main_stats ?? [] })))
      : ['balance_config creature.gen is missing']),
    ...(config.has('battle.formation')
      ? findFormationProblems(formationConfig(config.get('battle.formation') as Parameters<typeof formationConfig>[0]))
      : ['balance_config battle.formation is missing']),
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

async function nodeTables(pool: pg.Pool): Promise<string[]> {
  return (await pool.query<{ table_name: string }>("SELECT table_name FROM item.loot_tables WHERE owner = 'node'")).rows.map((r) => r.table_name);
}
