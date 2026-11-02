import { buildBalance } from '../../server/config/balance.ts';
import { createEntity, type CombatantSetup } from '../../server/battle/factory.ts';
import type { BattleData, MoveDef } from '../../server/battle/types.ts';
import { LinePicker } from '../../server/presentation/line_picker.ts';
import type { CoreStats } from '../../server/stats/derived.ts';

// Test copy of the seeded config (db/seeds/01_core: 01, 08, 09). Tests check hand math against it.
export const RAW_CONFIG = new Map<string, unknown>([
  ['move_level_cap', 25],
  ['trait_quota', { min: 10, max: 300 }],
  ['trait_window', { min_share: 0.35, max_share: 1 }],
  ['elements', ['fire', 'water', 'ice', 'earth', 'wind', 'lightning', 'holy', 'dark']],
  ['usage_exp', { hit: 5, miss: 2, critical: 8, kill: 12 }],
  ['curve.move_exp_required', { a: 30, b: 16, c: 0 }],
  ['curve.stat_exp_reward_base', { a: 15, b: 0 }],
  ['curve.stat_exp_required', { a: 47, b: 17 }],
  ['move_exp_enemy_scaling', { enabled: true, full_at: 0.4, min_mult: 0.1 }],
  ['standby.regen', { stamina_full_seconds: 20, mana_full_seconds: 40 }],
  ['derived.max_hp', { sqrt_str_end: 10, end: 4 }],
  ['derived.max_stamina', { sqrt_dex_end: 4, end: 14 }],
  ['derived.max_mana', { sqrt_int_end: 4, end: 9, int: 2 }],
  ['derived.max_inventory_weight', { str: 12, base: 30 }],
  ['derived.chance_factors', { crit: 0.001, dodge: 0.001, min_pair_mult: 2 }],
  ['combat.stat_mult', { base: 0.5, divisor: 10 }],
  ['combat.hit_chance', { base: 0.5, divisor: 20 }],
  ['combat.dodge_cap', 0.5],
  ['combat.defense_constant', 20],
  ['combat.crit_mult', 1.5],
  ['combat.min_damage', 1],
  ['combat.guard_reduction_cap', 0.8],
  ['combat.heal_in_combat_efficiency', 0.5],
  ['combat.stun_immunity_turns', 2],
  ['combat.atb_tick_ms', 100],
  ['combat.atb_fill_per_speed', 1],
  ['combat.atb_full', 100],
  ['combat.effect_turn_ms', 1000],
  ['combat.magic_stamina_share', 0.2],
  ['combat.reach_stray_chance', 0.25],
  ['growth.quick.damage_per_level', 0.03],
  ['growth.quick.recovery_per_level', -0.01],
  ['growth.quick.cost_per_level', -0.01],
  ['growth.guard.damage_per_level', 0.03],
  ['growth.guard.recovery_per_level', -0.01],
  ['growth.guard.cost_per_level', -0.01],
  ['body_tiers', { hp: [0, 0.15, 0.4, 0.65, 0.9], stamina: [0, 0.15, 0.4, 0.65, 0.9], mana: [0, 0.15, 0.4, 0.65, 0.9] }],
  ['move_level_words', { tiers: [1, 7, 13, 25] }],
  ['summoner_exp_bonus', 0.2],
  ['ai.heal_below_tier', 2],
  ['player_start_stats', { str: 5, dex: 5, int: 5, end: 5, luck: 5, charm: 5 }],
  ['player_start_moves', ['punch', 'kick']],
  ['loadout_slots', 8],
  ['loadout_swap_anywhere', false],
  ['town.inn', { price: 20 }],
  ['player_start_copper', 50],
  ['economy', {
    price_empty_mult: 2, price_full_mult: 0.5, shop_buy_share: 0.7, shop_sells_types: ['weapon', 'armor', 'tool', 'accessory'],
    capacity: { food: 40, part: 60, material: 40, carcass: 12, weapon: 3, armor: 3, tool: 4, accessory: 2, essence: 20 },
    specialty: { capacity_mult: 3, start_fill: 0.6, safe_fill: 0.2 }, start_fill: 0.35, safe_fill: 0.1,
    quality_value: { improvised: 0.5, crude: 0.6, common: 1, fine: 1.6, masterwork: 3 },
    craft: { fee_share: 0.5, min_fee: 1 },
  }],
  ['town_tick', {
    interval_hours: 1, reach: 2, villager_pay_share: 0.5, max_fill: 1.2, workforce_share: 0.4,
    consume_per_100: { food: 0.8, carcass: 0.1, part: 0.5, material: 0.6, weapon: 0.008, armor: 0.016, tool: 0.012, accessory: 0.004 },
    hunt: { per_worker: 2 }, wood: { per_worker: 3, item: 'oak_log', terrain: 'tree', full_share: 0.15 }, craft: { per_worker: 2 },
    wages: { hunter: 2, woodcutter: 1, cook: 1, tanner: 1 },
  }],
  ['world_clock', { check_seconds: 60, catch_up_hours: 48 }],
  ['growth.tiers', { band_levels: 6, tiers: { 1: [3, 1], 2: [5, 2], 3: [7, 3] } }],
  ['growth.race_exp', { human: [{ max_level: 6, mult: 1.15 }] }],
  ['vice', { types: ['str', 'dex', 'int', 'end', 'luck', 'charm'], main_weight: 2, find_permille: 20 }],
  ['world.gen', {
    corridors: [3, 7], towns: { 4: 6, 3: 4, 2: 3, 1: 2 }, town_spacing: 2, centre_biome: 'volcano',
    biomes: { 4: { seashore: 3, meadow: 3, grove: 2, desert: 1 }, 3: { meadow: 2, grove: 2, desert: 2, snow: 2, battlefield: 1 },
      2: { battlefield: 3, snow: 2, desert: 2, volcano: 1 }, 1: { battlefield: 2, volcano: 3, snow: 1 } },
    clump: 1.5, hex_max: 10000, safe_share: 0.08,
    town: { purse_per_person: 10, max_buy: { 4: 100, 3: 200, 2: 400, 1: 800 }, population: { 4: 300, 3: 600, 2: 1200, 1: 2400 },
      specialties: { meadow: ['chicken', 'lizard'] }, jobs: { farmer: 0.5, hunter: 0.5 } },
    vice_rings: [1, 2],
  }],
  ['gather', {
    chance_base: 0.8, chance_per_level: 0.02, guard_permille: 500,
    kinds: {
      rock: { move: 'mining', tools: ['pick', 'hammer'], bonus_tools: ['pick'], bonus_mult: 1.3, uses: 6, refill_per_hour: 1, exp: 8, near: [] },
      fish: { move: 'fishing', tools: ['rod'], bonus_tools: [], bonus_mult: 1, uses: 5, refill_per_hour: 1, exp: 8, near: ['water'] },
    },
  }],
  ['food', { duration_minutes: 30 }],
  ['battle.formation', { front: 4, back: 3, party_max: 4, enemy_max: 7, knockback_blocked_share: 0.25 }],
  ['creature.gen', {
    stat_range: { 4: [2, 3], 3: [5, 10], 2: [12, 17], 1: [20, 27] }, move_budget: { 4: 10, 3: 30, 2: 50, 1: 80 },
    die: { 4: 10, 3: 25, 2: 25, 1: 25 }, max_move_level: 25, corrupted_stat_mult: 1.2, corrupted_budget_per_step: 10,
  }],
  ['standing', {
    favor_tiers: [10, 30, 60], charm_favor: 1, charm_fame: 1,
    options: { haggle: { favor_tier: 1, fame: 0 } },
    haggle: { base_permille: 300, charm_permille: 20, min_permille: 50, max_permille: 900, margin: 0.1, fail_favor: 3 },
    generous: { margin: 0.2, favor: 2, cap_tier: 2 },
    pushover: { hours: 72, price_margin: 0.1, haggle_permille: 200 },
    fame: { radius: 2, falloff: 0.5, vice_kill: 20 },
  }],
  ['world.rings', {
    count: 4, creature_total: { 4: [15, 3], 3: [30, 5], 2: [60, 8], 1: [100, 11] }, vice_bonus: 30, boss_total: 250,
    conversion_per_ring: 0.008, start: { natives: [0.1, 0.8], corrupted: [0.3, 0.5] },
  }],
  ['gear_slots', [
    { slot: 'main_hand', accepts: 'hand', kind: 'wield' },
    { slot: 'off_hand', accepts: 'hand', kind: 'wield' },
    ...['head', 'body', 'hands', 'pants', 'feet'].map((s) => ({ slot: s, accepts: s, kind: 'wear' })),
    { slot: 'neck', accepts: 'neck', kind: 'adorn' },
    { slot: 'ears', accepts: 'ears', kind: 'adorn' },
    ...Array.from({ length: 10 }, (_, i) => ({ slot: `ring_${i + 1}`, accepts: 'ring', kind: 'adorn' })),
  ]],
  ['armor_body_shares', { head: 0.15, body: 0.35, hands: 0.15, pants: 0.2, feet: 0.15 }],
  ['gear_stack_falloff', 0.5],
  ['gear_wear_floor', 0.5],
  ['gear_condition_tiers', { thresholds: [0.25, 0.5, 0.75] }],
  ['load_light_below', 0.4],
  ['weight_limits', { slow_at: 0.7, stuck_at: 1.0, slow_walk_mult: 0.6, slow_atb_mult: 0.8 }],
  ['gear_wear_per_hit', 1],
  ['ammo_recovery_permille', 500],
  ['luck', { per_point: 1, bad_floor: 0 }],
  ['field.walk', { tiles_per_second: 3, max_path: 200 }],
  ['field.encounter', { per_step_permille: 100, grace_steps: 6, group_max: 4, near_town_group_max: 2 }],
  ['tick.birth', { interval_hours: 6, rate: 0.02 }],
  ['tick.conversion', { interval_hours: 10, rate: 0.01 }],
  ['tick.feeding', { interval_hours: 10, rate: 0.05, threshold: 1.2 }],
  ['tick.invasion', { interval_hours: 10, threshold: 1.5, share: 0.7 }],
  ['boss', { race: 'fiend', moves: ['punch', 'kick'], move_budget: 20, exp_per_vice: 100, max_weakening: 0.6 }],
  ['key_weakening', { per_key: 0.05, duplicate_falloff: 0.5 }],
  ['boss_set_weakening', 0.05],
  ['round', { closing_hours: 48 }],
  ['quality_nudge_permille', 20],
  ['quality.improvised.power_mult', 0.6],
  ['quality.common.power_mult', 1.0],
  ['world_time_scale', 1],
  ['carcass_rot', { hours: [6, 24, 72], chance_mult: [1, 0.8, 0.5, 0.25], quality_drop: [0, 0, 1, 2] }],
  ['quality_ladder', ['crude', 'common', 'fine', 'masterwork']],
  ['butchery', {
    move: 'butchery', tool_types: ['knife'], npc_level: 12, chance_base: 0.6, chance_per_level: 0.03,
    quality_up_at: [10, 18], exp_per_carcass: 10, fee_per_weight: 2, cut_share_permille: 400, npc_luck: 10,
  }],
  ['carcass_buyers', { shop: 0.6, butcher: 1, corrupted_mult: 0.8, shop_buys_corrupted: false }],
  ['coin_values', { copper_coin: 1, silver_coin: 100, gold_coin: 10000 }],
]);

export const cfg = buildBalance(RAW_CONFIG);

export function move(partial: Partial<MoveDef> & Pick<MoveDef, 'name' | 'effects'>): MoveDef {
  return {
    category: 'attack',
    damageType: 'blunt',
    damageKind: 'physical',
    element: null,
    resource: 'stamina',
    cost: 2,
    target: 'one_enemy',
    rowRule: 'front',
    windup: 0,
    recovery: 1,
    cooldown: null,
    channel: false,
    expScaling: 1,
    tier: 1,
    overrides: { damage: null, recovery: null, cost: null },
    growthTag: 'quick',
    tags: ['growth.quick', 'melee'],
    requires: [{ kind: 'body_part', value: 'hands', amount: null }],
    statExp: { str: 3, dex: 1 },
    gives: ['damage'],
    brokenBy: [],
    ...partial,
  };
}

export const MOVES = new Map<string, MoveDef>(
  [
    move({ name: 'punch', effects: [{ handler: 'damage', power: 10, durationTurns: null, chance: 1, params: { accuracy: 1 } }] }),
    move({
      name: 'bandage',
      category: 'heal',
      damageType: null,
      damageKind: null,
      target: 'one_ally',
      rowRule: 'any',
      windup: 0,
      channel: true,
      growthTag: 'guard',
      tags: ['growth.guard'],
      gives: [],
      brokenBy: ['damage', 'stun', 'knockback'],
      statExp: { int: 2, end: 2 },
      effects: [
        { handler: 'channel', power: 0, durationTurns: 3, chance: 1, params: {} },
        { handler: 'heal_over_time', power: 15, durationTurns: 3, chance: 1, params: {} },
      ],
    }),
  ].map((m) => [m.name, m]),
);

export function battleData(): BattleData {
  const lines = new LinePicker([
    { condition_key: 'use.blunt.kill', tier: 0, speaker: 'generic', personality_tag: null, expression: 'grim', text: 'It stays down.', locale: 'en' },
  ]);
  return { cfg, moves: MOVES, statuses: new Map(), lines, unlocks: [] };
}

export const stats = (overrides: Partial<CoreStats> = {}): CoreStats => ({
  str: 5, dex: 5, int: 5, end: 5, luck: 5, charm: 5, ...overrides,
});

export function fighter(id: string, side: 'party' | 'enemy', over: Partial<CombatantSetup> = {}) {
  return createEntity(cfg, {
    id,
    kind: side === 'party' ? 'player' : 'native',
    side,
    slot: 1,
    speaker: side === 'party' ? 'generic' : null,
    grows: side === 'party',
    corrupted: side === 'enemy',
    controller: 'player',
    stats: stats(),
    bodyParts: ['hands', 'feet'],
    moves: [{ name: 'punch', level: 1 }],
    ...over,
  });
}
