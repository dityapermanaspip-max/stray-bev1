import { buildBalance } from '../../server/config/balance.ts';
import { createEntity, type CombatantSetup } from '../../server/battle/factory.ts';
import type { BattleData, MoveDef } from '../../server/battle/types.ts';
import { LinePicker } from '../../server/presentation/line_picker.ts';
import type { CoreStats } from '../../server/stats/derived.ts';

// Test copy of the seeded config (db/seeds/01, 08, 09). Tests check hand math against it.
export const RAW_CONFIG = new Map<string, unknown>([
  ['move_level_cap', 20],
  ['usage_exp', { hit: 5, miss: 2, critical: 8, kill: 12 }],
  ['curve.move_exp_required', { a: 20, b: 9, c: 2 }],
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
  ['growth.quick.damage_per_level', 0.03],
  ['growth.quick.recovery_per_level', -0.01],
  ['growth.quick.cost_per_level', -0.01],
  ['growth.guard.damage_per_level', 0.03],
  ['growth.guard.recovery_per_level', -0.01],
  ['growth.guard.cost_per_level', -0.01],
  ['body_tiers', { hp: [0, 0.15, 0.4, 0.65, 0.9], stamina: [0, 0.15, 0.4, 0.65, 0.9], mana: [0, 0.15, 0.4, 0.65, 0.9] }],
  ['move_level_words', { tiers: [1, 5, 10, 20] }],
  ['summoner_exp_bonus', 0.2],
  ['ai.heal_below_tier', 2],
  ['player_start_stats', { str: 5, dex: 5, int: 5, end: 5, luck: 5, charm: 5 }],
  ['player_start_moves', ['punch', 'kick']],
  ['loadout_slots', 8],
  ['loadout_swap_anywhere', false],
  ['town.inn', { price: 20 }],
  ['player_start_copper', 50],
  ['economy', {
    price_empty_mult: 2, price_full_mult: 0.5, shop_buy_share: 0.7,
    capacity: { food: 40, part: 60, material: 40, carcass: 12, weapon: 3, armor: 3, tool: 4, accessory: 2, essence: 20 },
    specialty: { capacity_mult: 3, start_fill: 0.6 }, start_fill: 0.35,
    quality_value: { improvised: 0.5, crude: 0.6, common: 1, fine: 1.6, masterwork: 3 },
    craft: { fee_share: 0.5, min_fee: 1 },
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
  ['field.encounter', { per_step_permille: 100, grace_steps: 6, group_max: 4 }],
  ['tick.birth', { interval_hours: 6, rate: 0.02 }],
  ['tick.conversion', { interval_hours: 10, rate: 0.01 }],
  ['tick.feeding', { interval_hours: 10, rate: 0.05, threshold: 1.2 }],
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
    row: 'front',
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
