import { fitsSlot, type ItemDef } from '../inventory/items.ts';

// Pure startup-check rules. Data loading lives in check.ts.

export type LineGroup = {
  condition_key: string;
  tier: number;
  speaker: string;
  count: number;
};

export type MoveInfo = {
  move_name: string;
  tags: string[];
};

export const NAME_PREFIX = 'move_name_';
const GROWTH_KEY = /^growth\.([a-z_]+)\.(damage|recovery|cost)_per_level$/;

// A growth tag is known only when all three rates exist in balance_config.
export function knownGrowthTags(configKeys: string[]): Set<string> {
  const rates = new Map<string, Set<string>>();
  for (const key of configKeys) {
    const match = GROWTH_KEY.exec(key);
    if (!match) continue;
    const set = rates.get(match[1]) ?? new Set<string>();
    set.add(match[2]);
    rates.set(match[1], set);
  }
  return new Set([...rates].filter(([, set]) => set.size === 3).map(([tag]) => tag));
}

export const ARRIVAL_PREFIX = 'arrival.';
export const ITEM_NAME_PREFIX = 'item_name_';
export const SPECIES_NAME_PREFIX = 'species_name_';
export const BODY_WORD_PREFIX = 'body_word.';
export const SERVICE_NAME_PREFIX = 'service_name_';
export const BIOME_NAME_PREFIX = 'biome_name_'; // world map biome names
export const NODE_NAME_PREFIX = 'node_name_'; // resource node kinds (gather config)
export const BATTLE_LINE_KEYS = ['battle.won', 'battle.lost', 'battle.cannot'];
export const TOWN_LINE_KEYS = [
  'town.inn.rested', 'town.inn.no_money', 'town.closed', 'town.shop.nothing', 'loadout.not_here',
  'town.shop.sold', 'town.shop.bought', 'town.shop.no_money', 'town.shop.too_dear', 'town.shop.cannot_pay', 'town.shop.out',
  'town.craft.done', 'town.craft.missing', 'town.craft.cannot_pay',
  'ask.door', 'ask.exit', // the yes / no question before a door or an exit (game/ask.ts)
  // the shopkeeper's standing (standing/shop_standing.ts); greetings also need tiers 1-3 (checked below)
  'town.shop.greet', 'town.shop.haggle_won', 'town.shop.haggle_lost', 'town.shop.generous', 'town.shop.pushover',
  // status window refusals (game/status_service.ts)
  'loadout.in_battle', 'loadout.bad_slot', 'loadout.unknown_move', 'loadout.not_slottable', 'gear.not_held', 'gear.not_wearable', 'gear.bad_slot',
];
const NAME_PREFIXES = [NAME_PREFIX, ITEM_NAME_PREFIX, SPECIES_NAME_PREFIX, BODY_WORD_PREFIX, SERVICE_NAME_PREFIX, BIOME_NAME_PREFIX, NODE_NAME_PREFIX];
const isNameKey = (key: string) => NAME_PREFIXES.some((p) => key.startsWith(p));
const isSingleLineKey = (key: string) => isNameKey(key) || key.startsWith(ARRIVAL_PREFIX);

// Every generic pool needs minLines sentences. Display names and arrival text need exactly one.
export function findLineProblems(groups: LineGroup[], minLines: number): string[] {
  return groups.flatMap((g) => {
    const label = `${g.condition_key} tier ${g.tier} (${g.speaker})`;
    if (g.condition_key.startsWith(ARRIVAL_PREFIX)) return g.count === 1 ? [] : [`${label}: needs exactly 1 line, has ${g.count}`];
    if (isSingleLineKey(g.condition_key) || g.count >= minLines) return [];
    return [`${label}: ${g.count} of ${minLines} lines`];
  });
}

// Each arrival question needs its text, the configured number of answers, and text for each answer.
export function findArrivalProblems(
  answers: { question_key: string; answer_key: string }[],
  lineKeys: Set<string>,
  answersPerQuestion: number,
): string[] {
  const problems: string[] = [];
  const byQuestion = new Map<string, string[]>();
  for (const a of answers) byQuestion.set(a.question_key, [...(byQuestion.get(a.question_key) ?? []), a.answer_key]);
  for (const [question, keys] of byQuestion) {
    if (!lineKeys.has(`${ARRIVAL_PREFIX}q.${question}`)) problems.push(`arrival ${question}: missing question line`);
    if (keys.length !== answersPerQuestion) {
      problems.push(`arrival ${question}: ${keys.length} answers, needs ${answersPerQuestion}`);
    }
    for (const key of keys) {
      if (!lineKeys.has(`${ARRIVAL_PREFIX}a.${question}.${key}`)) problems.push(`arrival ${question}.${key}: missing answer line`);
    }
  }
  return problems;
}

// Each body resource needs a line pool for every tier its thresholds define.
export function findBodyTierProblems(
  bodyTiers: Record<string, number[]>,
  groups: LineGroup[],
  speaker: string,
): string[] {
  const problems: string[] = [];
  for (const [resource, thresholds] of Object.entries(bodyTiers)) {
    for (let tier = 1; tier <= thresholds.length; tier++) {
      const key = `body.${resource}`;
      const found = groups.some((g) => g.condition_key === key && g.tier === tier && g.speaker === speaker);
      if (!found) problems.push(`${key} tier ${tier} (${speaker}): no lines`);
    }
  }
  return problems;
}

// Text lines carry no numbers. Display names are exempt.
export function findNumberProblems(lines: { condition_key: string; text: string }[]): string[] {
  return lines
    .filter((l) => !isNameKey(l.condition_key) && /\d/.test(l.text))
    .map((l) => `${l.condition_key}: line contains a number: "${l.text}"`);
}

// Each move needs exactly one known growth tag and a display name line.
export function findMoveProblems(
  moves: MoveInfo[],
  growthTags: Set<string>,
  nameKeys: Set<string>,
): string[] {
  const problems: string[] = [];
  for (const move of moves) {
    const growth = move.tags.filter((t) => t.startsWith('growth.')).map((t) => t.slice('growth.'.length));
    if (growth.length !== 1) {
      problems.push(`${move.move_name}: needs exactly one growth tag, has ${growth.length}`);
    }
    for (const tag of growth) {
      if (!growthTags.has(tag)) problems.push(`${move.move_name}: unknown growth tag ${tag}`);
    }
    if (!nameKeys.has(NAME_PREFIX + move.move_name)) {
      problems.push(`${move.move_name}: missing ${NAME_PREFIX}${move.move_name} line`);
    }
  }
  return problems;
}

// Each item needs a name line; gear needs a durability source; slots and granted moves must exist.
// Every slot kind needs equip and unequip lines, and every load tier needs lines.
export function findItemProblems(
  items: ItemDef[],
  slots: { accepts: string; kind: string }[],
  lineKeys: Set<string>,
  moveNames: Set<string>,
  loadTiers: number,
  loadTierKeys: Set<string>,
): string[] {
  const problems: string[] = [];
  const accepts = new Set(slots.map((s) => s.accepts));
  for (const item of items) {
    if (!lineKeys.has(ITEM_NAME_PREFIX + item.name)) problems.push(`${item.name}: missing ${ITEM_NAME_PREFIX}${item.name} line`);
    if (!item.stack && fitsSlot(item) && !(Number(item.maxDurability) > 0)) problems.push(`${item.name}: gear needs max_durability or a material durability`);
    const fits = fitsSlot(item);
    if (fits && !accepts.has(fits)) problems.push(`${item.name}: no gear slot accepts ${fits}`);
    const grants = item.wield?.grantsMove;
    if (grants && !moveNames.has(grants)) problems.push(`${item.name}: grants unknown move ${grants}`);
    if (item.worn?.armor && !item.material) problems.push(`${item.name}: armor needs a core material`);
  }
  for (const kind of new Set(slots.map((s) => s.kind))) {
    for (const key of [`gear.equip.${kind}`, `gear.unequip.${kind}`]) if (!lineKeys.has(key)) problems.push(`${key}: no lines`);
  }
  for (let tier = 1; tier <= loadTiers; tier++) if (!loadTierKeys.has(`load|${tier}`)) problems.push(`load tier ${tier}: no lines`);
  return problems;
}

// Every unlock rule needs a known kind, a known move, and an epiphany line pool for its kind.
export function findUnlockProblems(
  rules: { move_name: string; kind: string }[],
  knownKinds: string[],
  lineKeys: Set<string>,
  epiphanyPrefix: string,
): string[] {
  const problems: string[] = [];
  for (const rule of rules) {
    if (!knownKinds.includes(rule.kind)) problems.push(`${rule.move_name}: unknown unlock kind ${rule.kind}`);
    else if (!lineKeys.has(epiphanyPrefix + rule.kind)) problems.push(`${rule.move_name}: no ${epiphanyPrefix}${rule.kind} lines`);
  }
  return [...new Set(problems)];
}

// Loot: every loot line pool and freshness tier has lines; rots_to, coins and the butchery move exist.
export function findLootProblems(
  items: ItemDef[],
  lootKeys: string[],
  lineKeys: Set<string>,
  tierKeys: Set<string>,
  freshnessTiers: number,
  coins: string[],
  moveNames: Set<string>,
  butcheryMove: string,
): string[] {
  const names = new Set(items.map((i) => i.name));
  const problems = lootKeys.filter((k) => !lineKeys.has(k)).map((k) => `${k}: no lines`);
  for (let tier = 1; tier <= freshnessTiers; tier++) {
    if (!tierKeys.has(`carcass.freshness|${tier}`)) problems.push(`carcass freshness tier ${tier}: no lines`);
  }
  for (const item of items) if (item.rotsTo && !names.has(item.rotsTo)) problems.push(`${item.name}: rots to unknown item ${item.rotsTo}`);
  for (const coin of coins) if (!names.has(coin)) problems.push(`coin_values: unknown coin item ${coin}`);
  if (!moveNames.has(butcheryMove)) problems.push(`butchery: unknown move ${butcheryMove}`);
  return problems;
}

// Battle screen text: a name per species, a body word per resource tier, and the battle sentence pools.
export function findBattleProblems(
  species: string[], bodyTiers: Record<string, number[]>, lineKeys: Set<string>, tierKeys: Set<string>,
): string[] {
  return [
    ...species.filter((s) => !lineKeys.has(SPECIES_NAME_PREFIX + s)).map((s) => `species ${s}: no ${SPECIES_NAME_PREFIX} line`),
    ...Object.entries(bodyTiers).flatMap(([resource, thresholds]) => thresholds
      .map((_, i) => `${BODY_WORD_PREFIX}${resource}|${i + 1}`)
      .filter((k) => !tierKeys.has(k))
      .map((k) => `${k.replace('|', ' tier ')}: no word`)),
    ...BATTLE_LINE_KEYS.filter((k) => !lineKeys.has(k)).map((k) => `${k}: no lines`),
  ];
}

// Town text: a name for every service a town template has, and the door sentence pools.
// favorTiers: how many favor tiers above stranger; the shopkeeper greets at each of them.
export function findTownLineProblems(services: string[], lineKeys: Set<string>, tierKeys = new Set<string>(), favorTiers = 0): string[] {
  const greet = Array.from({ length: favorTiers }, (_, i) => i + 1).filter((t) => !tierKeys.has(`town.shop.greet|${t}`));
  return [
    ...[...new Set(services)].filter((s) => !lineKeys.has(SERVICE_NAME_PREFIX + s)).map((s) => `service ${s}: no ${SERVICE_NAME_PREFIX} line`),
    ...TOWN_LINE_KEYS.filter((k) => !lineKeys.has(k)).map((k) => `${k}: no lines`),
    ...greet.map((t) => `town.shop.greet tier ${t}: no lines`),
  ];
}

// Recipes: known items with names on both sides, positive counts, a level of 1 or more, and a named craftsman.
type ItemQty = { item: string; qty: number };
export function findCraftProblems(
  recipes: { name: string; facility: string; level: number; inputs: ItemQty[]; outputs: ItemQty[] }[], items: Set<string>, lineKeys: Set<string>,
): string[] {
  const side = (name: string, what: string, xs: ItemQty[]) => [
    ...(xs.length === 0 ? [`recipe ${name}: no ${what}`] : []),
    ...xs.filter((x) => !items.has(x.item)).map((x) => `recipe ${name}: unknown ${what} item ${x.item}`),
    ...xs.filter((x) => items.has(x.item) && !lineKeys.has(ITEM_NAME_PREFIX + x.item)).map((x) => `recipe ${name}: ${x.item} has no name`),
    ...xs.filter((x) => !Number.isInteger(x.qty) || x.qty < 1).map((x) => `recipe ${name}: bad qty for ${x.item}`),
  ];
  return recipes.flatMap((r) => [
    ...(lineKeys.has(SERVICE_NAME_PREFIX + r.facility) ? [] : [`recipe ${r.name}: craftsman ${r.facility} has no ${SERVICE_NAME_PREFIX} line`]),
    ...(Number.isInteger(r.level) && r.level >= 1 ? [] : [`recipe ${r.name}: level must be 1 or more`]),
    ...side(r.name, 'input', r.inputs),
    ...side(r.name, 'output', r.outputs),
  ]);
}
