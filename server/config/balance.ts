import type pg from 'pg';
import { formationConfig, type FormationConfig } from '../battle/formation.ts';
import { creatureGenConfig, type CreatureGenConfig } from './creature_config.ts';
import { blendConfig, type BlendConfig } from './blend_config.ts';
import { foodConfig, gatherConfig, type FoodConfig, type GatherConfig } from './gather_config.ts';
import { interiorConfig, type InteriorConfig } from './interior_config.ts';
import { growthConfig, type GrowthConfig } from './growth_config.ts';
import { standingConfig, type StandingConfig } from './standing_config.ts';
import { worldGenConfig, type WorldGenConfig } from './worldgen_config.ts';
import type { FleeConfig } from '../battle/flee.ts';
import { bossConfig, ringConfig, viceConfig, type BossConfig, type RingConfig, type ViceConfig } from './world_config.ts';
import { clockConfig, economyConfig, townTickConfig, type ClockConfig, type EconomyConfig, type TownTickConfig } from './town_config.ts';
import type { LuckConfig } from '../util/luck.ts';
import type { TraitRules } from '../growth/traits.ts';

// Typed view of balance_config. Every number the battle uses comes from here.

export type Curve = { a: number; b: number; c?: number };
export type GrowthRates = { damage_per_level: number; recovery_per_level: number; cost_per_level: number };
export type BodyResource = 'hp' | 'stamina' | 'mana';
export type GearSlot = { slot: string; accepts: string; kind: string };

export type GearConfig = {
  slots: GearSlot[];
  bodyShares: Record<string, number>; // armor slot -> share of a full set
  stackFalloff: number;
  wearFloor: number;
  conditionTiers: number[];
  loadLightBelow: number;
  weightLimits: { slow_at: number; stuck_at: number; slow_walk_mult: number; slow_atb_mult: number };
  wearPerHit: number; // durability a weapon loses per landed hit, and one armor piece per hit taken
  ammoRecoveryPermille: number; // per thrown item or arrow, after a win; the thrower's luck adds to it
};

export type DerivedConfig = {
  maxHp: { sqrt_str_end: number; end: number };
  maxStamina: { sqrt_dex_end: number; end: number };
  maxMana: { sqrt_int_end: number; end: number; int: number };
  maxInventoryWeight: { str: number; base: number };
  chance: { crit: number; dodge: number; min_pair_mult: number };
};

export type CombatConfig = {
  statMult: { base: number; divisor: number };
  hitChance: { base: number; divisor: number };
  dodgeCap: number;
  defenseConstant: number;
  critMult: number;
  minDamage: number;
  guardReductionCap: number;
  healInCombatEfficiency: number;
  stunImmunityTurns: number;
  atbTickMs: number;
  atbFillPerSpeed: number;
  atbFull: number; flee: FleeConfig; // flee: running away (battle/flee.ts)
  effectTurnMs: number;
  magicStaminaShare: number;
  commandMode: 'active' | 'wait'; // battle.command_mode
  idleAutoMs: number; // battle.idle_auto_seconds in ms
  reachStrayChance: number; // a reach move (spear) used from behind a living front row hits an ally instead
};

export type LootConfig = {
  rot: { hours: number[]; chanceMult: number[]; qualityDrop: number[] }; // freshness tiers 1-4
  qualityLadder: string[]; // worst to best
  butchery: {
    move: string;
    toolTypes: string[];
    npcLevel: number;
    chanceBase: number;
    chancePerLevel: number;
    qualityUpAt: number[];
    expPerCarcass: number;
    feePerWeight: number; // copper per unit of carcass weight
    cutSharePermille: number; // chance per part unit the butcher keeps when paid in parts
    npcLuck: number; // the town butcher's own luck
  };
  buyers: { shop: number; butcher: number; corruptedMult: number; shopBuysCorrupted: boolean };
  coins: Record<string, number>; // coin item -> copper value
  qualityNudgePermille: number; // chance a part comes out one quality step better; luck adds to it
};

type RawButchery = {
  move: string; tool_types: string[]; npc_level: number; chance_base: number; chance_per_level: number;
  quality_up_at: number[]; exp_per_carcass: number; fee_per_weight: number; cut_share_permille: number; npc_luck: number;
};

export type BalanceConfig = {
  moveLevelCap: number;
  usageExp: { hit: number; miss: number; critical: number; kill: number };
  curves: { moveExpRequired: Curve; statExpRewardBase: Curve; statExpRequired: Curve };
  enemyScaling: { enabled: boolean; full_at: number; min_mult: number };
  standbyRegen: { stamina_full_seconds: number; mana_full_seconds: number };
  derived: DerivedConfig;
  combat: CombatConfig;
  growth: Map<string, GrowthRates>;
  bodyTiers: Record<BodyResource, number[]>;
  moveLevelWords: number[];
  summonerExpBonus: number; // hidden
  traits: TraitRules; // quota roll (growth/traits.ts), hidden
  aiHealBelowTier: number;
  playerStartStats: Record<string, number>;
  playerStartMoves: string[];
  loadoutSlots: number;
  loadoutSwapAnywhere: boolean; // testing flag (false: swaps only inside a town's safe square)
  town: { innPrice: number; startCopper: number }; // inn rest price and a new player's purse, in copper
  gear: GearConfig;
  qualityMult: Map<string, number>;
  loot: LootConfig;
  worldTimeScale: number;
  luck: LuckConfig;
  walk: { tilesPerSecond: number; maxPath: number };
  encounter: EncounterConfig;
  ticks: TickConfig;
  economy: EconomyConfig;
  townTick: TownTickConfig;
  clock: ClockConfig;
  rings: RingConfig;
  vice: ViceConfig;
  boss: BossConfig;
  round: { closingHours: number }; // real hours a round stays open after its boss first falls
  statGrowth: GrowthConfig; // stat exp by move tier, hidden race move exp rules
  standing: StandingConfig; // hidden favor, fame and haggling rules
  worldGen: WorldGenConfig; // how a new round's map is made
  blend: BlendConfig; // biome connector rank (public order, no numbers)
  gather: GatherConfig; // resource nodes (hidden numbers)
  interior: InteriorConfig; // town service rooms and wild camps and caves
  food: FoodConfig;
  creatureGen: CreatureGenConfig; // how regular creatures are rolled per ring (hidden)
  formation: FormationConfig; // battle slots per side
};


// Encounters roll per tile stepped: per_step_permille at full density (total pop / max pop, capped at 1).
export type { ClockConfig, EconomyConfig, RingConfig, TownTickConfig };

// nearTownGroupMax: biggest group in the corridor next to a town (where strays are summoned).
export type EncounterConfig = { perStepPermille: number; graceSteps: number; groupMax: number; nearTownGroupMax: number };
// World tick rules on counts. Hours before world_time_scale.
export type TickConfig = {
  birth: { intervalHours: number; rate: number };
  conversion: { intervalHours: number; rate: number };
  feeding: { intervalHours: number; rate: number; threshold: number };
  invasion: { intervalHours: number; threshold: number; share: number }; // a vice leads share of the corrupted out at threshold x max
};

const GROWTH_KEY = /^growth\.([a-z_]+)\.(damage|recovery|cost)_per_level$/;
const QUALITY_KEY = /^quality\.([a-z_]+)\.power_mult$/;

export function buildBalance(raw: Map<string, unknown>): BalanceConfig {
  const need = <T>(key: string): T => {
    if (!raw.has(key)) throw new Error(`balance_config missing ${key}`);
    return raw.get(key) as T;
  };
  const num = (key: string): number => {
    const value = need<unknown>(key);
    if (typeof value !== 'number') throw new Error(`balance_config ${key} must be a number`);
    return value;
  };

  const growth = new Map<string, GrowthRates>();
  for (const [key, value] of raw) {
    const match = GROWTH_KEY.exec(key);
    if (!match) continue;
    const rates = growth.get(match[1]) ?? { damage_per_level: 0, recovery_per_level: 0, cost_per_level: 0 };
    rates[`${match[2]}_per_level` as keyof GrowthRates] = value as number;
    growth.set(match[1], rates);
  }

  const qualityMult = new Map<string, number>();
  for (const [key, value] of raw) {
    const match = QUALITY_KEY.exec(key);
    if (match) qualityMult.set(match[1], value as number);
  }

  return {
    moveLevelCap: num('move_level_cap'),
    usageExp: need('usage_exp'),
    curves: {
      moveExpRequired: need('curve.move_exp_required'),
      statExpRewardBase: need('curve.stat_exp_reward_base'),
      statExpRequired: need('curve.stat_exp_required'),
    },
    enemyScaling: need('move_exp_enemy_scaling'),
    standbyRegen: need('standby.regen'),
    derived: {
      maxHp: need('derived.max_hp'),
      maxStamina: need('derived.max_stamina'),
      maxMana: need('derived.max_mana'),
      maxInventoryWeight: need('derived.max_inventory_weight'),
      chance: need('derived.chance_factors'),
    },
    combat: {
      statMult: need('combat.stat_mult'),
      hitChance: need('combat.hit_chance'),
      dodgeCap: num('combat.dodge_cap'),
      defenseConstant: num('combat.defense_constant'),
      critMult: num('combat.crit_mult'),
      minDamage: num('combat.min_damage'),
      guardReductionCap: num('combat.guard_reduction_cap'),
      healInCombatEfficiency: num('combat.heal_in_combat_efficiency'),
      stunImmunityTurns: num('combat.stun_immunity_turns'),
      atbTickMs: num('combat.atb_tick_ms'),
      atbFillPerSpeed: num('combat.atb_fill_per_speed'),
      atbFull: num('combat.atb_full'),
      flee: need('combat.flee'),
      effectTurnMs: num('combat.effect_turn_ms'),
      magicStaminaShare: num('combat.magic_stamina_share'),
      reachStrayChance: num('combat.reach_stray_chance'),
      commandMode: need<string>('battle.command_mode') === 'wait' ? 'wait' : 'active',
      idleAutoMs: num('battle.idle_auto_seconds') * 1000,
    },
    growth,
    bodyTiers: need('body_tiers'),
    moveLevelWords: need<{ tiers: number[] }>('move_level_words').tiers,
    summonerExpBonus: num('summoner_exp_bonus'),
    traits: {
      quota: need('trait_quota'),
      window: { minShare: need<{ min_share: number }>('trait_window').min_share, maxShare: need<{ max_share: number }>('trait_window').max_share },
      elements: need('elements'),
    },
    aiHealBelowTier: num('ai.heal_below_tier'),
    playerStartStats: need('player_start_stats'),
    playerStartMoves: need('player_start_moves'),
    loadoutSlots: num('loadout_slots'),
    loadoutSwapAnywhere: need('loadout_swap_anywhere'),
    town: { innPrice: need<{ price: number }>('town.inn').price, startCopper: num('player_start_copper') },
    gear: {
      slots: need('gear_slots'),
      bodyShares: need('armor_body_shares'),
      stackFalloff: num('gear_stack_falloff'),
      wearFloor: num('gear_wear_floor'),
      conditionTiers: need<{ thresholds: number[] }>('gear_condition_tiers').thresholds,
      loadLightBelow: num('load_light_below'),
      weightLimits: need('weight_limits'),
      wearPerHit: num('gear_wear_per_hit'),
      ammoRecoveryPermille: num('ammo_recovery_permille'),
    },
    qualityMult,
    loot: {
      rot: (({ hours, chance_mult, quality_drop }) => ({ hours, chanceMult: chance_mult, qualityDrop: quality_drop }))(
        need<{ hours: number[]; chance_mult: number[]; quality_drop: number[] }>('carcass_rot'),
      ),
      qualityLadder: need('quality_ladder'),
      butchery: ((b) => ({
        move: b.move, toolTypes: b.tool_types, npcLevel: b.npc_level, chanceBase: b.chance_base, chancePerLevel: b.chance_per_level,
        qualityUpAt: b.quality_up_at, expPerCarcass: b.exp_per_carcass, feePerWeight: b.fee_per_weight,
        cutSharePermille: b.cut_share_permille, npcLuck: b.npc_luck,
      }))(need<RawButchery>('butchery')),
      buyers: (({ shop, butcher, corrupted_mult, shop_buys_corrupted }) => ({
        shop, butcher, corruptedMult: corrupted_mult, shopBuysCorrupted: shop_buys_corrupted,
      }))(need<{ shop: number; butcher: number; corrupted_mult: number; shop_buys_corrupted: boolean }>('carcass_buyers')),
      coins: need('coin_values'),
      qualityNudgePermille: num('quality_nudge_permille'),
    },
    worldTimeScale: num('world_time_scale'),
    walk: (({ tiles_per_second, max_path }) => ({ tilesPerSecond: tiles_per_second, maxPath: max_path }))(
      need<{ tiles_per_second: number; max_path: number }>('field.walk'),
    ),
    luck: (({ per_point, bad_floor }) => ({ perPoint: per_point, badFloor: bad_floor }))(need<{ per_point: number; bad_floor: number }>('luck')),
    economy: economyConfig(need('economy')),
    townTick: townTickConfig(need('town_tick')),
    clock: clockConfig(need('world_clock')),
    rings: ringConfig(need('world.rings')),
    vice: viceConfig(need('vice')),
    boss: bossConfig(need('boss'), need('key_weakening'), Number(need('boss_set_weakening'))),
    round: { closingHours: Number(need<{ closing_hours: number }>('round').closing_hours) },
    statGrowth: growthConfig(need('growth.tiers'), need('growth.race_exp')),
    standing: standingConfig(need('standing')),
    worldGen: worldGenConfig(need('world.gen')),
    blend: blendConfig(need('biome_blend')),
    gather: gatherConfig(need('gather')),
    interior: interiorConfig(need('interior')),
    food: foodConfig(need('food')),
    creatureGen: creatureGenConfig(need('creature.gen')),
    formation: formationConfig(need('battle.formation')),
    encounter: (({ per_step_permille, grace_steps, group_max, near_town_group_max }) => ({
      perStepPermille: per_step_permille, graceSteps: grace_steps, groupMax: group_max, nearTownGroupMax: near_town_group_max,
    }))(need<{ per_step_permille: number; grace_steps: number; group_max: number; near_town_group_max: number }>('field.encounter'),
    ),
    ticks: {
      birth: (({ interval_hours, rate }) => ({ intervalHours: interval_hours, rate }))(need<{ interval_hours: number; rate: number }>('tick.birth')),
      conversion: (({ interval_hours, rate }) => ({ intervalHours: interval_hours, rate }))(need<{ interval_hours: number; rate: number }>('tick.conversion')),
      feeding: (({ interval_hours, rate, threshold }) => ({ intervalHours: interval_hours, rate, threshold }))(
        need<{ interval_hours: number; rate: number; threshold: number }>('tick.feeding'),
      ),
      invasion: (({ interval_hours, threshold, share }) => ({ intervalHours: interval_hours, threshold, share }))(
        need<{ interval_hours: number; threshold: number; share: number }>('tick.invasion'),
      ),
    },
  };
}

export async function loadBalance(pool: pg.Pool): Promise<BalanceConfig> {
  const res = await pool.query<{ config_key: string; value: unknown }>(
    'SELECT config_key, value FROM config.balance_config',
  );
  return buildBalance(new Map(res.rows.map((r) => [r.config_key, r.value])));
}
