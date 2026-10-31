// Typed view of the `standing` key of balance_config (hidden: server only). See seeds/09_standing/01_config.sql.

export type OptionGate = { favorTier: number; fame: number };
export type StandingConfig = {
  favorTiers: number[]; // favor needed for tier 1, 2, ...
  charmFavor: number; // favor each charm point counts as at a gate
  charmFame: number;
  options: Record<string, OptionGate>;
  haggle: { basePermille: number; charmPermille: number; minPermille: number; maxPermille: number; margin: number; failFavor: number };
  generous: { margin: number; favor: number; capTier: number };
  pushover: { hours: number; priceMargin: number; hagglePermille: number };
  fame: { radius: number; falloff: number; viceKill: number };
};

type Raw = {
  favor_tiers: number[]; charm_favor: number; charm_fame: number;
  options: Record<string, { favor_tier: number; fame: number }>;
  haggle: { base_permille: number; charm_permille: number; min_permille: number; max_permille: number; margin: number; fail_favor: number };
  generous: { margin: number; favor: number; cap_tier: number };
  pushover: { hours: number; price_margin: number; haggle_permille: number };
  fame: { radius: number; falloff: number; vice_kill: number };
};

export function standingConfig(r: Raw): StandingConfig {
  const h = r.haggle;
  return {
    favorTiers: [...r.favor_tiers].sort((a, b) => a - b),
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
