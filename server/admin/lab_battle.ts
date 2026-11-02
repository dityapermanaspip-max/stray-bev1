import { createEntity, createProgress } from '../battle/factory.ts';
import { growerEntity } from '../battle/from_state.ts';
import { BattleInstance } from '../battle/instance.ts';
import type { BattleData, BattleEntity, Side } from '../battle/types.ts';
import type { RaceDef, SpeciesDef } from '../data/species_repo.ts';
import type { Progress } from '../growth/level_up.ts';
import type { Inventory } from '../inventory/bag.ts';
import { buildCombatGear } from '../inventory/combat_gear.ts';
import type { ItemCatalog } from '../inventory/items.ts';
import type { LootData } from '../inventory/loot.ts';
import type { FieldData } from '../data/field_repo.ts';
import { slottable } from '../loadout/loadout.ts';
import { STATS } from '../stats/derived.ts';
import { gearInfo, gearWear, labInventory } from './lab_gear.ts';
import { labCarcasses } from './lab_loot.ts';
import type { LabBattleRequest, LabBattleResult, LabFighter, LabGrowth } from './lab_types.ts';

// Runs one sandbox battle from a lab setup. Nothing is saved. The server still runs every step.

export type LabWorld = {
  data: BattleData;
  species: Map<string, SpeciesDef>;
  races: Map<string, RaceDef>;
  catalog: ItemCatalog;
  loot: LootData;
  fields: FieldData;
};

const LIMITS = { party: 4, enemies: 8, stat: 999, seconds: 900 };

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

function checkFighter(world: LabWorld, f: LabFighter, where: string): string | null {
  if (f.source === 'species' && !world.species.has(f.species ?? '')) return `${where}: unknown species ${f.species}`;
  for (const m of f.moves) if (!world.data.moves.has(m.name)) return `${where}: unknown move ${m.name}`;
  for (const m of f.moves) if (m.equipped && !slottable(world.data.moves, m.name)) return `${where}: ${m.name} is a life skill and cannot be equipped`;
  if (f.moves.filter((m) => m.equipped).length > world.data.cfg.loadoutSlots) return `${where}: too many equipped moves`;
  if (f.gear !== undefined && !Array.isArray(f.gear)) return `${where}: gear must be a list`;
  return labInventory(world.data.cfg, world.catalog, f, createProgress(f.stats, []), where).error;
}

export function validateLab(world: LabWorld, req: LabBattleRequest): string | null {
  if (!Array.isArray(req.party) || !Array.isArray(req.enemies)) return 'party and enemies must be lists';
  if (req.party.length < 1 || req.party.length > LIMITS.party) return `party needs 1 to ${LIMITS.party} fighters`;
  const enemyCount = req.enemies.reduce((n, e) => n + clamp(e.count, 1, LIMITS.enemies, 1), 0);
  if (enemyCount < 1 || enemyCount > LIMITS.enemies) return `enemies need 1 to ${LIMITS.enemies} fighters`;
  for (const [i, f] of req.party.entries()) {
    const problem = checkFighter(world, f, `party ${i + 1}`);
    if (problem) return problem;
  }
  for (const [i, f] of req.enemies.entries()) {
    const problem = checkFighter(world, f, `enemy ${i + 1}`);
    if (problem) return problem;
  }
  return null;
}

type Built = { entity: BattleEntity; progress: Progress | null; inventory: Inventory };

function build(world: LabWorld, f: LabFighter, id: string, side: Side): Built {
  const { cfg } = world.data;
  const stats = Object.fromEntries(STATS.map((s) => [s, clamp(f.stats?.[s], 0, LIMITS.stat, 5)])) as LabFighter['stats'];
  const moves = f.moves.map((m) => ({ name: m.name, level: clamp(m.level, 1, cfg.moveLevelCap, 1) }));
  const equipped = f.moves.filter((m) => m.equipped).map((m) => m.name);
  const slot = f.slot && f.slot >= 1 && f.slot <= cfg.formation.front + cfg.formation.back ? Math.round(f.slot) : f.row === 'back' ? cfg.formation.front + 1 : 1;
  const progress = createProgress(stats, moves);
  const { inventory } = labInventory(cfg, world.catalog, f, progress, id);
  const gear = buildCombatGear(cfg, world.catalog, inventory);

  if (f.source === 'human') {
    const loadout = new Map(equipped.map((name, i) => [i + 1, name]));
    const entity = growerEntity(cfg, {
      id, kind: 'player', side, slot, speaker: side === 'party' ? 'self' : 'generic', controller: 'ai',
      progress, loadout, bodyParts: world.races.get('human')?.bodyParts ?? [], body: null, gear,
    });
    return { entity, progress, inventory };
  }
  const def = world.species.get(f.species!)!;
  const levels = new Map(moves.map((m) => [m.name, m.level]));
  const entity = createEntity(cfg, {
    id, kind: 'native', side, slot, speaker: null, grows: false, corrupted: !!f.corrupted, controller: 'ai',
    stats, bodyParts: def.bodyParts, resist: def.resist, gear,
    moves: equipped.map((name) => ({ name, level: levels.get(name) ?? 1 })),
  });
  return { entity, progress: null, inventory };
}

function snapshotProgress(p: Progress) {
  return {
    stats: Object.fromEntries(STATS.map((s) => [s, p.stats[s].base])),
    moves: new Map([...p.moves].map(([name, k]) => [name, k.level])),
  };
}

export function runLabBattle(world: LabWorld, req: LabBattleRequest): LabBattleResult {
  const { cfg } = world.data;
  const entities: BattleEntity[] = [];
  const labels = new Map<string, string>();
  const speciesOf = new Map<string, string>();
  const progress = new Map<string, Progress>();
  const bags = new Map<string, Inventory>();
  const gearBefore = new Map<string, ReturnType<typeof gearInfo>>();
  const add = (f: LabFighter, side: Side, index: number) => {
    const copies = side === 'enemy' ? clamp(f.count, 1, LIMITS.enemies, 1) : 1;
    for (let c = 0; c < copies; c++) {
      const id = `${side === 'party' ? 'p' : 'e'}${index + 1}${copies > 1 ? String.fromCharCode(97 + c) : ''}`;
      const built = build(world, f, id, side);
      entities.push(built.entity);
      bags.set(id, built.inventory);
      gearBefore.set(id, gearInfo(cfg, world.catalog, built.entity, built.inventory));
      if (f.source !== 'human' && f.species) speciesOf.set(id, f.species);
      labels.set(id, `${f.label || f.species || 'fighter'}${copies > 1 ? ` ${c + 1}` : ''}`);
      if (built.progress) progress.set(id, built.progress);
    }
  };
  req.party.forEach((f, i) => add(f, 'party', i));
  req.enemies.forEach((f, i) => add(f, 'enemy', i));

  const before = new Map([...progress].map(([id, p]) => [id, snapshotProgress(p)]));
  const battle = new BattleInstance(world.data, {
    entities, progress, seed: Math.floor(clamp(req.seed, 0, 2 ** 31, 1)),
    summonerSides: new Set(req.summonerInParty ? ['party'] : []),
  });

  const frames: LabBattleResult['frames'] = [];
  const damageBy: Record<string, number> = {};
  const maxMs = clamp(req.maxSeconds, 1, LIMITS.seconds, 300) * 1000;
  let t = 0;
  while (!battle.winner && t < maxMs) {
    t += cfg.combat.atbTickMs;
    const events = battle.tick(cfg.combat.atbTickMs);
    if (events.length === 0) continue;
    for (const e of events) if (e.type === 'damage') damageBy[e.source] = (damageBy[e.source] ?? 0) + e.amount;
    frames.push({
      t,
      events,
      state: battle.entities.map((e) => ({
        id: e.id, hp: e.hp, stamina: Math.round(e.stamina * 10) / 10, mana: Math.round(e.mana * 10) / 10,
        atb: e.atb, phase: e.phase, effects: e.effects.map((f) => f.kind),
      })),
    });
  }

  const growth: LabGrowth[] = [...progress].map(([id, p]) => {
    const b = before.get(id)!;
    return {
      id,
      stats: STATS.map((s) => ({ stat: s, before: b.stats[s], after: p.stats[s].base, exp: Math.round(p.stats[s].exp * 10) / 10 })),
      moves: [...p.moves].map(([move, k]) => ({
        move, before: b.moves.get(move) ?? 0, after: k.level, exp: Math.round(k.exp * 10) / 10, learned: !b.moves.has(move),
      })),
    };
  });

  return {
    winner: battle.winner,
    durationMs: t,
    entities: entities.map((e) => ({
      id: e.id, label: labels.get(e.id)!, side: e.side, row: e.row,
      maxHp: e.derived.maxHp, maxStamina: e.derived.maxStamina, maxMana: e.derived.maxMana, moves: e.moves,
      gear: gearBefore.get(e.id)!, wear: gearWear(bags.get(e.id)!, e),
    })),
    frames,
    growth,
    damageBy,
    carcasses: battle.winner === 'party' ? labCarcasses(world, entities, bags, speciesOf, labels) : { taken: [], left: [] },
  };
}
