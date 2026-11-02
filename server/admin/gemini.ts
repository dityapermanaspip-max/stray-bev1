import type pg from 'pg';
import { blankMob, exportMob, mobReference, type MobDraft } from './mob_draft.ts';
import { blankDraft, exportMove, LINE_MOMENTS, moveReference, type MoveDraft } from './move_draft.ts';

// The admin lab's AI helper: asks Gemini (REST API, plain fetch, no library) to fill one move or creature draft from a
// short description. GEMINI_API_KEY and GEMINI_MODEL come from stray-bev1/.env and never reach the browser.
// What is sent: the description, the names the game knows (effect types with sample params, tags, damage types...),
// a few existing moves or creatures as examples, and the rules. The answer is only a draft: the admin reviews and saves it.

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 90_000;

export const aiReady = () => Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL);

export type AiRequest = { prompt: string; examples?: string[]; draft?: MoveDraft | null; only?: 'all' | 'lines' };
export type AiMobRequest = { prompt: string; examples?: string[] };
export type AiBalanceRequest<T> = { draft: T; prompt?: string };
export type Balanced<T> = { draft: T; notes: string[] };

const RULES = `You design one new move for a hex-grid RPG with an ATB battle system. Answer with ONE JSON object in exactly the draft shape given.
Rules:
- move.name: new, lowercase snake_case, not in the existing move list. lines.name: its display name, Title Case.
- Use only effect types, damage types, body parts, species and recipes from the reference. Copy the param keys of an effect type's sample.
- Numbers (cost, power, windup, recovery, chance 0-1) should sit near the example moves of the same tier and branch.
- tags: include tree:<tree>, branch:<branch>, growth.<tag> and tier:<n> like the examples (reuse existing tags).
- unlocks: usually one mastery option on the parent move of the branch, shaped like the examples' unlocks.
- stat_exp: small whole numbers splitting which core stats (str, dex, int, end, luck, charm) the move trains.
- lines: first-person thoughts of the fighter, one short sentence each, plain words, NO digits or numbers, never the move's name.
  Give 6 different lines for each moment that fits: ${LINE_MOMENTS.join(', ')} (crit/kill/miss for strikes, cast for moves without a strike,
  counter for counter stances). Lines may be strings.
- species, recipe_requires and teach: leave empty unless the description asks for them.
- All characters are adults. No sexual content, no abuse.`;

export async function aiDraft(pool: pg.Pool, req: AiRequest): Promise<MoveDraft> {
  const prompt = String(req.prompt ?? '').slice(0, 4000);
  if (!prompt.trim()) throw new Error('describe the move first');
  const ref = await moveReference(pool);
  const names = (req.examples ?? []).filter((n) => ref.moves.includes(n)).slice(0, 4);
  const examples = (await Promise.all((names.length > 0 ? names : ['punch']).map((n) => exportMove(pool, n)))).filter(Boolean);
  const task = req.only === 'lines' && req.draft
    ? `Keep every field of this draft exactly as it is; only write lines.name and the line pools that fit it:\n${JSON.stringify(req.draft)}`
    : `Draft shape (fill every field):\n${JSON.stringify(req.draft ?? blankDraft())}`;
  return askGemini<MoveDraft>([
    RULES, `Reference (names that exist):\n${JSON.stringify(ref)}`, `Example moves:\n${JSON.stringify(examples)}`, task, `The move to design:\n${prompt}`,
  ]);
}

const MOB_RULES = `You design one new creature (species) for a hex-grid RPG. Answer with ONE JSON object in exactly the draft shape given.
Rules:
- species.name: new, lowercase snake_case, not in the existing species list. display_name: Title Case.
- Strength is rolled per encounter from the ring (gen.stat_range, gen.move_budget), so the species only shapes it:
  main_stats: the 2 core stats (str, dex, int, end, luck, charm) that roll high in every ring. base_stats: a small reference
  profile (whole numbers 1+), not used in battle. biomes: [{biome, weight}] from the reference biomes decide where it lives
  (any ring: a ring 1 meadow holds very strong chickens). ring_min/ring_max: keep 1 and the outer ring. variant_of: null
  unless it is a variant of an existing species (then an empty move pool, main stats or body parts come from it).
- moves: its move pool (up to about 20); each creature learns a random part of it, levels handed out by dice. Only existing
  moves, and only moves whose needed body parts are all in body_parts.
- resistances: optional; target_kind damage_type, element or status, target an existing name, mult below 1 resists, above 1 is weak.
- loot.native and loot.corrupted: chance out of 1000 per entry, min and max counts. Corrupted tables use tainted_meat instead of meat,
  spoiled parts, and carry essence (about 700). Some drops may be worthless on purpose. Use existing items, or add new part items in
  items (name snake_case, type part/food/material, shape, display in plain words, data with weight and value; meat: edible true and
  rots_to rotten_meat).
- carcass: weight and value grow with the creature's size. populate: null unless asked.
- No numbers in display names. All creatures are animals or monsters; nothing sexual.`;

export async function aiMob(pool: pg.Pool, req: AiMobRequest): Promise<MobDraft> {
  const prompt = String(req.prompt ?? '').slice(0, 4000);
  if (!prompt.trim()) throw new Error('describe the creature first');
  const ref = await mobReference(pool);
  const names = (req.examples ?? []).filter((n) => ref.species.includes(n)).slice(0, 3);
  const examples = (await Promise.all((names.length > 0 ? names : ref.species.slice(0, 2)).map((n) => exportMob(pool, n)))).filter(Boolean);
  return askGemini<MobDraft>([
    MOB_RULES, `Reference (names that exist):\n${JSON.stringify(ref)}`, `Example creatures:\n${JSON.stringify(examples)}`,
    `Draft shape (fill every field):\n${JSON.stringify(blankMob())}`, `The creature to design:\n${prompt}`,
  ]);
}

// AI balancer: the draft, its peers (moves sharing its tree and tier tags; creatures sharing a ring) and the ring
// ladder go to Gemini, which answers with the same draft with numbers adjusted and short notes on what and why.
// Names, links and lines stay; only numbers move. The admin reviews it and Checks before saving.
const BALANCE_RULES = `You balance one entry of a hex-grid RPG against its peers. Answer with ONE JSON object: {"draft": <the same draft
shape, every field kept>, "notes": [short sentences: what you changed and why]}.
Rules: change only numbers (power, cost, windup, recovery, chance, duration, stat exp, base stats, loot chances and counts, carcass
weight and value). Keep names, tags, links, body parts, items and lines exactly. Aim for the middle of the peers of the same tier or
ring, unless the admin's focus says otherwise. Creature stats are rolled per ring; for a creature balance its main stats, move pool, loot and carcass.
If it is already fair, return it unchanged and say so in notes.`;

const focus = (prompt?: string) => `Admin's focus:\n${String(prompt ?? '').slice(0, 2000).trim() || 'general fairness'}`;
const peersOf = async (pool: pg.Pool, sql: string, args: unknown[]) => (await pool.query(sql, args)).rows.map((r) => String(r.v));

export async function aiBalanceMove(pool: pg.Pool, req: AiBalanceRequest<MoveDraft>): Promise<Balanced<MoveDraft>> {
  const d = req.draft;
  if (!d?.move?.name) throw new Error('load or write a move first');
  const marks = (d.tags ?? []).filter((t) => t.startsWith('tier:') || t.startsWith('tree:'));
  const names = await peersOf(pool, `SELECT m.move_name AS v FROM moves.moves m JOIN moves.move_tags t ON t.move_id = m.id
    WHERE t.tag = ANY($1) AND m.move_name <> $2 GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 6`, [marks, d.move.name]);
  const peers = (await Promise.all(names.map((n) => exportMove(pool, n)))).filter(Boolean)
    .map((p) => ({ ...p, lines: undefined })); // lines say nothing about balance
  return askGemini<Balanced<MoveDraft>>([BALANCE_RULES, `Peer moves:\n${JSON.stringify(peers)}`, `The move to balance:\n${JSON.stringify(d)}`, focus(req.prompt)]);
}

export async function aiBalanceMob(pool: pg.Pool, req: AiBalanceRequest<MobDraft>): Promise<Balanced<MobDraft>> {
  const d = req.draft;
  if (!d?.species?.name) throw new Error('load or write a creature first');
  const names = await peersOf(pool, `SELECT species_name AS v FROM entity.species WHERE ring_min <= $2 AND ring_max >= $1 AND species_name <> $3
    ORDER BY 1 LIMIT 5`, [d.species.ring_min, d.species.ring_max, d.species.name]);
  const [ref, peers] = await Promise.all([mobReference(pool), Promise.all(names.map((n) => exportMob(pool, n)))]);
  return askGemini<Balanced<MobDraft>>([BALANCE_RULES, `Ring ladder:\n${JSON.stringify(ref.rings)}`,
    `Peer creatures:\n${JSON.stringify(peers.filter(Boolean))}`, `The creature to balance:\n${JSON.stringify(d)}`, focus(req.prompt)]);
}

async function askGemini<T>(parts: string[]): Promise<T> {
  const key = process.env.GEMINI_API_KEY ?? '';
  const model = process.env.GEMINI_MODEL ?? '';
  if (!key || !model) throw new Error('set GEMINI_API_KEY and GEMINI_MODEL in stray-bev1/.env, then restart npm run admin');
  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: parts.join('\n\n') }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.8 },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string }; candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${body.error?.message ?? 'request failed'}`);
  const out = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  try {
    return JSON.parse(out.replace(/^```(?:json)?\s*|\s*```$/g, '')) as T;
  } catch {
    throw new Error('Gemini did not answer with JSON; try again');
  }
}
