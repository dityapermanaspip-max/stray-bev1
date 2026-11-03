// Typed view of the `standing` key of balance_config (hidden: server only). See seeds/09_standing/01_config.sql and 03_ladder.sql.

export type OptionGate = { favorTier: number; fame: number };
export type RoleBase = { base: number; spread: number };
export type LadderConfig = {
  tiers: number; // tiers above stranger
  stepMult: number; // each step is this times the one before, rounded up
  talkCap: number; // favor-giving contacts per NPC per tick
  talkTickHours: number; // world hours in one tick
  fameDiv: number; fameFloor: number; // a talk gives charm x max(fameFloor, 1 + town fame / fameDiv)
  gift: { minTier: number; perDays: number; favor: number };
  sameSexMaxTier: number; // a pair of the same body type stops here
  summonerStartTier: number; // the player's own summoner starts at this tier with them
  greetTiers: number; // tiers the startup check wants shopkeeper greetings for
  refuseFame: number; // a shop turns away fame at or under this in its town
  roles: Record<string, RoleBase>; // base threshold by role; `default` covers the rest
  unlocks: Record<string, number>; // what each tier opens: hire, gift, party, loadout, butcher_child, command
  salaryFavor: number; // favor a paid wage adds, on top of the talk cap
  hireDays: number; // world days one wage payment covers
};
export type StandingConfig = {
  ladder: LadderConfig;
  charmFavor: number; // favor each charm point counts as at a gate
  charmFame: number;
  options: Record<string, OptionGate>;
  haggle: { basePermille: number; charmPermille: number; minPermille: number; maxPermille: number; margin: number; failFavor: number };
  generous: { margin: number; favor: number; capTier: number };
  pushover: { hours: number; priceMargin: number; hagglePermille: number };
  fame: { radius: number; falloff: number; viceKill: number };
};

type Raw = {
  ladder: {
    tiers: number; step_mult: number; talk_cap: number; talk_tick_hours: number; fame_div: number; fame_floor: number;
    gift: { min_tier: number; per_days: number; favor: number };
    same_sex_max_tier: number; summoner_start_tier: number; greet_tiers: number; refuse_fame: number;
    roles: Record<string, RoleBase>;
    unlocks: Record<string, number>; salary_favor: number; hire_days: number;
  };
  charm_favor: number; charm_fame: number;
  options: Record<string, { favor_tier: number; fame: number }>;
  haggle: { base_permille: number; charm_permille: number; min_permille: number; max_permille: number; margin: number; fail_favor: number };
  generous: { margin: number; favor: number; cap_tier: number };
  pushover: { hours: number; price_margin: number; haggle_permille: number };
  fame: { radius: number; falloff: number; vice_kill: number };
};

export function standingConfig(r: Raw): StandingConfig {
  const h = r.haggle;
  const l = r.ladder;
  return {
    ladder: {
      tiers: l.tiers, stepMult: l.step_mult, talkCap: l.talk_cap, talkTickHours: l.talk_tick_hours, fameDiv: l.fame_div, fameFloor: l.fame_floor,
      gift: { minTier: l.gift.min_tier, perDays: l.gift.per_days, favor: l.gift.favor },
      sameSexMaxTier: l.same_sex_max_tier, summonerStartTier: l.summoner_start_tier, greetTiers: l.greet_tiers, refuseFame: l.refuse_fame,
      roles: l.roles, unlocks: l.unlocks, salaryFavor: l.salary_favor, hireDays: l.hire_days,
    },
    charmFavor: r.charm_favor,
    charmFame: r.charm_fame,
    options: Object.fromEntries(Object.entries(r.options).map(([k, o]) => [k, { favorTier: o.favor_tier, fame: o.fame }])),
    haggle: {
      basePermille: h.base_permille, charmPermille: h.charm_permille, minPermille: h.min_permille, maxPermille: h.max_permille,
      margin: h.margin, failFavor: h.fail_favor,
    },
    generous: { margin: r.generous.margin, favor: r.generous.favor, capTier: r.generous.cap_tier },
    pushover: { hours: r.pushover.hours, priceMargin: r.pushover.price_margin, hagglePermille: r.pushover.haggle_permille },
    fame: { radius: r.fame.radius, falloff: r.fame.falloff, viceKill: r.fame.vice_kill },
  };
}
