import type pg from 'pg';
import type { BalanceConfig } from '../config/balance.ts';
import { loadTraitOptions } from '../data/entity_load.ts';
import { inTransaction, writeLoadout, writeProgress, writeTraits } from '../data/entity_save.ts';
import { writeInventory } from '../data/item_repo.ts';
import type { Progress } from '../growth/level_up.ts';
import { hasTraitFlag, type TraitOption } from '../growth/traits.ts';
import type { UnlockRule } from '../growth/unlocks.ts';
import { addItem, emptyInventory, stackKey } from '../inventory/bag.ts';
import { equipGear } from '../inventory/gear.ts';
import type { ItemCatalog } from '../inventory/items.ts';
import { STATS, type CoreStats } from '../stats/derived.ts';
import type { Rng } from '../util/rng.ts';
import { rollRecruit, type RaceMods, type RolledRecruit } from './recruit_roll.ts';
import { mercenaryWage, parseTemplate, recruitConfig, type RecruitConfig, type RecruitTemplate } from './recruit_rules.ts';
import { planRoster, type TownForRoster } from './roster.ts';

// Recruits in the DB (world.town_recruits, entity.recruit_templates). Notables and door keepers are
// world.town_keepers rows (service = the door, or the notable's role). Everything here is hidden.

export type RecruitDeps = {
  pool: pg.Pool; cfg: BalanceConfig; catalog: ItemCatalog; unlocks: readonly UnlockRule[]; roundId: string;
  rc: RecruitConfig; templates: Map<string, RecruitTemplate>; traitOptions: TraitOption[];
  names: Map<string, string[]>; // race -> given names (npc_name.<race>); '' = anyone's (npc_name)
  races: Map<string, RaceMods>;
};

export const NPC_NAME_KEY = 'npc_name';

export async function loadRecruitData(pool: pg.Pool): Promise<Pick<RecruitDeps, 'rc' | 'templates' | 'traitOptions' | 'names' | 'races'>> {
  const [config, templates, traitOptions, names, races] = await Promise.all([
    pool.query<{ value: Record<string, unknown> }>("SELECT value FROM config.balance_config WHERE config_key = 'recruit'"),
    pool.query<{ template_name: string; data: Record<string, unknown> }>('SELECT template_name, data FROM entity.recruit_templates'),
    loadTraitOptions(pool),
    pool.query<{ key: string; text: string }>(
      `SELECT condition_key AS key, text FROM presentation.diegetic_lines
       WHERE condition_key = $1 OR condition_key LIKE $1 || '.%' ORDER BY text`,
      [NPC_NAME_KEY],
    ),
    pool.query<{ race_name: string; stat_mods: Partial<CoreStats> }>('SELECT race_name, stat_mods FROM entity.races'),
  ]);
  if (!config.rows[0]) throw new Error('balance_config recruit is missing');
  const byRace = new Map<string, string[]>();
  for (const n of names.rows) {
    const race = n.key === NPC_NAME_KEY ? '' : n.key.slice(NPC_NAME_KEY.length + 1);
    byRace.set(race, [...(byRace.get(race) ?? []), n.text]);
  }
  return {
    rc: recruitConfig(config.rows[0].value),
    templates: new Map(templates.rows.map((r) => [r.template_name, parseTemplate(r.template_name, r.data)])),
    traitOptions,
    names: byRace,
    races: new Map(races.rows.map((r) => [r.race_name, { name: r.race_name, statMods: r.stat_mods ?? {} }])),
  };
}

// Towns of a round with their ring, people living there now, their doors and their culture's folk. Visitors are the
// races of the other cultures. A town with no culture is human.
export async function loadRosterTowns(pool: pg.Pool, roundId: string): Promise<TownForRoster[]> {
  type Row = { ref: string; ring: number; population: number | null; services: string[] | null; race: string | null; data: Record<string, unknown> | null };
  const res = await pool.query<Row>(
    `SELECT t.id::text AS ref, h.ring, e.population,
            (SELECT array_agg(b->>'service') FROM jsonb_array_elements(ft.params->'town'->'buildings') b) AS services,
            r.race_name AS race, c.data
     FROM world.towns t JOIN world.hexes h ON h.id = t.hex_id
     LEFT JOIN world.town_economy e ON e.town_ref = t.id::text
     LEFT JOIN world.field_templates ft ON ft.template_name = t.template
     LEFT JOIN world.cultures c ON c.culture_name = t.culture
     LEFT JOIN entity.races r ON r.id = c.race_id
     WHERE t.round_id = $1 ORDER BY h.ring DESC, h.q, h.r`,
    [roundId],
  );
  const folk = (await pool.query<{ race: string }>(
    'SELECT DISTINCT r.race_name AS race FROM world.cultures c JOIN entity.races r ON r.id = c.race_id ORDER BY 1',
  )).rows.map((r) => r.race);
  return res.rows.map((r) => {
    const race = r.race ?? 'human';
    return {
      ref: r.ref, ring: r.ring, population: Number(r.population ?? 0), services: r.services ?? [], race,
      visitors: folk.filter((f) => f !== race), visitorShare: Number(r.data?.visitor_share ?? 0),
      poolWeights: (r.data?.pool_weights as Record<string, number> | undefined) ?? {},
    };
  });
}

// The keeper behind a door or a notable role, made if missing (same rows the shop's keeper uses), of the town's folk.
async function ensureKeeper(client: pg.PoolClient, roundId: string, townRef: string, service: string, race: string): Promise<string> {
  const found = await client.query<{ id: string }>('SELECT entity_id AS id FROM world.town_keepers WHERE town_ref = $1 AND service = $2', [townRef, service]);
  if (found.rows[0]) return found.rows[0].id;
  const made = await client.query<{ id: string }>(
    `INSERT INTO entity.entities (kind, name, round_id, location_ref, race_id)
     VALUES ('native', $3, $1, $2, (SELECT id FROM entity.races WHERE race_name = $4)) RETURNING id`,
    [roundId, townRef, service, race],
  );
  await client.query('INSERT INTO world.town_keepers (town_ref, service, entity_id) VALUES ($1, $2, $3)', [townRef, service, made.rows[0].id]);
  return made.rows[0].id;
}

type Placement = { townRef: string; source: 'pool' | 'lineage' | 'summoner'; spot: string; parentId: string | null; boundTo: string | null };

// One rolled recruit as a real entity: race, stats, moves (no stat exp), best moves equipped, traits and affinity,
// gear in hand, and its place in the town.
async function writeRecruit(client: pg.PoolClient, d: RecruitDeps, t: RecruitTemplate, r: RolledRecruit, at: Placement, rng: Rng): Promise<string> {
  const kind = at.source === 'summoner' ? 'summoner' : 'recruit';
  const names = d.names.get(r.race) ?? d.names.get('') ?? [];
  const name = names.length > 0 ? names[Math.floor(rng() * names.length)] : t.name;
  const res = await client.query<{ id: string }>(
    `INSERT INTO entity.entities (kind, name, race_id, round_id, location_ref, is_summoner)
     SELECT $1, $2, r.id, $3, $4, $5 FROM entity.races r WHERE r.race_name = $6 RETURNING id`,
    [kind, name, d.roundId, at.townRef, kind === 'summoner', r.race],
  );
  if (!res.rows[0]) throw new Error(`template ${t.name}: unknown race ${r.race}`);
  const id = res.rows[0].id;
  const progress: Progress = {
    stats: Object.fromEntries(STATS.map((s) => [s, { base: r.stats[s], exp: 0 }])) as Progress['stats'],
    moves: new Map([...r.moves, ...r.life].map((m) => [m.name, { level: m.level, exp: 0 }])),
    recipes: new Set(),
  };
  const inv = emptyInventory();
  const dual = hasTraitFlag(r.traits, 'dual_wield');
  for (const g of r.gear) {
    const def = d.catalog.get(g.item);
    const qty = def?.ammoType ? d.rc.ammoCarried : 1;
    if (addItem(d.catalog, inv, g.item, qty)) throw new Error(`template ${t.name}: unknown item ${g.item}`);
    if (g.slot === 'bag') continue; // carried, not held (arrows)
    const ref = def!.stack ? { stack: stackKey(g.item, def!.defaultQuality) } : { piece: inv.pieces[inv.pieces.length - 1].id };
    const done = equipGear(d.cfg, d.catalog, inv, progress, ref, { inTown: true, inBattle: false }, g.slot, dual);
    if (typeof done === 'string') throw new Error(`template ${t.name}: ${g.item} to ${g.slot} refused (${done})`);
  }
  await writeProgress(client, id, progress, true);
  await writeLoadout(client, id, new Map(r.moves.filter((m) => m.equipped).map((m, i) => [i + 1, m.name])));
  await writeTraits(client, id, r.traits);
  await writeInventory(client, id, inv);
  await client.query(
    `INSERT INTO world.town_recruits (entity_id, town_ref, template, source, spot, parent_id, bound_to, wage_per_day)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, at.townRef, t.name, at.source, at.spot, at.parentId, at.boundTo, t.mercenary ? mercenaryWage(d.rc, r.totalLevels) : null],
  );
  return id;
}

const raceOf = (d: RecruitDeps, race: string): RaceMods => d.races.get(race) ?? { name: race, statMods: {} };

export type Filled = { notables: string[]; lineage: number; pool: number };

// Brings one town's roster up to full (notables, one heir or pupil per parent, the pool at its share). One transaction.
export async function fillTown(d: RecruitDeps, town: TownForRoster, rng: Rng): Promise<Filled> {
  const now = await d.pool.query<{ pool: string; offering: string[] | null }>(
    `SELECT count(*) FILTER (WHERE r.source = 'pool') AS pool,
            array_agg(k.service || '|' || r.template) FILTER (WHERE r.source = 'lineage') AS offering
     FROM world.town_recruits r LEFT JOIN world.town_keepers k ON k.entity_id = r.parent_id
     WHERE r.town_ref = $1`,
    [town.ref],
  );
  const plan = planRoster(d.rc, d.cfg.rings.count, town, [...d.templates.values()],
    { pool: Number(now.rows[0].pool), offering: new Set(now.rows[0].offering ?? []) }, rng);
  return inTransaction(d.pool, async (client) => {
    for (const role of plan.notables) await ensureKeeper(client, d.roundId, town.ref, role, town.race);
    for (const { parent, template, race } of plan.lineage) {
      const parentId = await ensureKeeper(client, d.roundId, town.ref, parent, town.race);
      const rolled = rollRecruit(d.cfg, d.rc, template, town.ring, rng, d.unlocks, d.traitOptions, raceOf(d, race));
      await writeRecruit(client, d, template, rolled, { townRef: town.ref, source: 'lineage', spot: parent, parentId, boundTo: null }, rng);
    }
    for (const { template, race } of plan.pool) {
      const rolled = rollRecruit(d.cfg, d.rc, template, town.ring, rng, d.unlocks, d.traitOptions, raceOf(d, race));
      await writeRecruit(client, d, template, rolled, { townRef: town.ref, source: 'pool', spot: template.spot ?? 'street', parentId: null, boundTo: null }, rng);
    }
    return { notables: plan.notables, lineage: plan.lineage.length, pool: plan.pool.length };
  });
}

// A player's summoner: a notable's heir in a random town of the round, rolled once per round, bound to that player,
// of that town's folk. Whether the player ever finds them is another story. Returns null if the player already has
// one in this round (a summoner from an ended round is replaced).
export async function rollSummoner(d: RecruitDeps, playerId: string, rng: Rng): Promise<string | null> {
  const has = await d.pool.query(
    'SELECT 1 FROM entity.entities p JOIN entity.entities s ON s.id = p.summoner_id WHERE p.id = $1 AND s.round_id = $2', [playerId, d.roundId],
  );
  if (has.rowCount) return null;
  const template = [...d.templates.values()].find((t) => t.source === 'summoner');
  const towns = await loadRosterTowns(d.pool, d.roundId);
  if (!template || towns.length === 0) return null;
  const town = towns[Math.floor(rng() * towns.length)];
  const roles = d.rc.summonerFrom.filter((r) => d.rc.notables.some((n) => n.role === r && town.population >= n.minPopulation));
  if (roles.length === 0) return null;
  const role = roles[Math.floor(rng() * roles.length)];
  return inTransaction(d.pool, async (client) => {
    const parentId = await ensureKeeper(client, d.roundId, town.ref, role, town.race);
    const rolled = rollRecruit(d.cfg, d.rc, template, town.ring, rng, d.unlocks, d.traitOptions, raceOf(d, town.race));
    const id = await writeRecruit(client, d, template, rolled, { townRef: town.ref, source: 'summoner', spot: role, parentId, boundTo: playerId }, rng);
    await client.query('UPDATE entity.entities SET summoner_id = $2 WHERE id = $1', [playerId, id]);
    return id;
  });
}
