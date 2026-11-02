import type { BodyNow } from '../data/entity_load.ts';
import { createProgress } from '../battle/factory.ts';
import { applyBody } from '../battle/from_state.ts';
import { BattleInstance } from '../battle/instance.ts';
import type { BattleData } from '../battle/types.ts';
import type { RaceDef, SpeciesDef } from '../data/species_repo.ts';
import type { Progress } from '../growth/level_up.ts';
import { equip, firstFreeSlot, slotOf, starterLoadout } from '../loadout/loadout.ts';
import type { CoreStats } from '../stats/derived.ts';
import { createRng, pick } from '../util/rng.ts';
import { buildCreature, buildPlayer } from './combatants.ts';

// Early-game pacing sim: chained fights, sitting to refill stamina and mana, HP carried over.
// Shared by the session CLI and the admin lab. Developer tool only.

export type SessionOptions = {
  fights: number;
  enemies: string[];
  corruptedShare: number;
  ring?: number; // where the creatures are met (default the outer ring)
  lowHpTier: number;
  seed: number;
  start: { stats: CoreStats; moves: { name: string; level: number }[] } | null;
};

export type SessionPoint = { fight: number; atMs: number; sitMs: number; hpTier: number; movesKnown: number; outcome: string };
export type Milestone = { label: string; atMs: number; fight: number };

export type SessionResult = {
  wins: number;
  passedOut: number;
  lowHpStops: number;
  fightMs: number;
  sitMs: number;
  milestones: Milestone[];
  series: SessionPoint[];
  moves: { name: string; level: number }[];
  stats: Record<string, number>;
};

export type SessionWorld = { data: BattleData; species: Map<string, SpeciesDef>; races: Map<string, RaceDef> };

export function runSession(world: SessionWorld, opts: SessionOptions): SessionResult {
  const { data } = world;
  const { cfg } = data;
  const rng = createRng(opts.seed);
  const bodyParts = world.races.get('human')?.bodyParts ?? [];
  const enemyPool = opts.enemies.map((n) => world.species.get(n.trim())).filter((s): s is SpeciesDef => !!s);
  if (enemyPool.length === 0) throw new Error('no known enemy species');
  const startStats = opts.start?.stats ?? (cfg.playerStartStats as CoreStats);
  const startMoves = opts.start?.moves ?? cfg.playerStartMoves.map((name) => ({ name, level: 1 }));
  const progress: Progress = { ...createProgress(startStats, startMoves), race: 'human' }; // the sim player is human

  // The sim player equips each new move into a free slot (swaps allowed anywhere until towns exist).
  const loadout = starterLoadout(cfg, startMoves.map((m) => m.name));
  const anywhere = { inTown: false, inBattle: false };
  const r: SessionResult = { wins: 0, passedOut: 0, lowHpStops: 0, fightMs: 0, sitMs: 0, milestones: [], series: [], moves: [], stats: {} };
  let carried: BodyNow | null = null;
  const mark = (label: string, fight: number) => {
    if (!r.milestones.some((m) => m.label === label)) r.milestones.push({ label, atMs: r.fightMs + r.sitMs, fight });
  };

  for (let fight = 1; fight <= opts.fights; fight++) {
    const player = buildPlayer(cfg, progress, loadout, bodyParts);
    if (carried) applyBody(cfg, player, carried);
    const enemy = buildCreature(cfg, pick(rng, enemyPool)!, 1, rng() < opts.corruptedShare, opts.ring ?? cfg.rings.count, rng);
    const battle = new BattleInstance(data, {
      entities: [player, enemy],
      progress: new Map([['player', progress]]),
      summonerSides: new Set(),
      seed: Math.floor(rng() * 2 ** 31),
    });
    const learned: string[] = [];
    for (let t = 0; !battle.winner && t < 600_000; t += cfg.combat.atbTickMs) {
      for (const e of battle.tick(cfg.combat.atbTickMs)) if (e.type === 'learned') learned.push(e.move);
      r.fightMs += cfg.combat.atbTickMs;
    }

    if ([...progress.moves.values()].some((m, i) => m.level > (startMoves[i]?.level ?? 1))) mark('first move level-up', fight);
    for (const [stat, sp] of Object.entries(progress.stats)) {
      if (sp.base > (startStats[stat as keyof CoreStats] ?? 0)) mark('first stat increase', fight);
    }
    for (const move of learned) {
      mark(`epiphany: ${move}`, fight);
      const slot = firstFreeSlot(cfg, loadout);
      if (slot !== null && slotOf(loadout, move) === null) equip(cfg, loadout, progress, data.moves, slot, move, anywhere);
    }

    let outcome = 'won';
    let sit = 0;
    if (battle.winner !== 'party') {
      r.passedOut += 1;
      outcome = 'passed_out';
      carried = null; // wakes in town with full HP
    } else if (player.tiers.hp <= opts.lowHpTier) {
      r.wins += 1;
      r.lowHpStops += 1; // would drink a potion or head to town
      outcome = 'low_hp_stop';
      carried = null;
    } else {
      r.wins += 1;
      // Sit until stamina and mana are full. HP never regenerates.
      const staminaSec = (1 - player.stamina / player.derived.maxStamina) * cfg.standbyRegen.stamina_full_seconds;
      const manaSec = (1 - player.mana / player.derived.maxMana) * cfg.standbyRegen.mana_full_seconds;
      sit = Math.max(staminaSec, manaSec) * 1000;
      r.sitMs += sit;
      carried = { hp: player.hp, stamina: player.derived.maxStamina, mana: player.derived.maxMana };
    }
    r.series.push({ fight, atMs: r.fightMs + r.sitMs, sitMs: sit, hpTier: player.tiers.hp, movesKnown: progress.moves.size, outcome });
  }

  r.moves = [...progress.moves].map(([name, k]) => ({ name, level: k.level }));
  r.stats = Object.fromEntries(Object.entries(progress.stats).map(([s, v]) => [s, v.base]));
  return r;
}
