import type pg from 'pg';
import { pick, type Rng } from '../util/rng.ts';

// Picks one diegetic sentence. Order: speaker override, personality match, generic.
// Avoids repeating the last line picked for the same key.

export type LineRow = {
  condition_key: string;
  tier: number;
  speaker: string;
  personality_tag: string | null;
  expression: string;
  text: string;
  locale: string;
};

export type PickedLine = { text: string; expression: string };

export const GENERIC_SPEAKER = 'generic';

export class LinePicker {
  private pools = new Map<string, LineRow[]>();
  private last = new Map<string, string>();

  constructor(rows: LineRow[], locale = 'en') {
    for (const row of rows) {
      if (row.locale !== locale) continue;
      const key = this.poolKey(row.condition_key, row.tier, row.speaker, row.personality_tag);
      const pool = this.pools.get(key) ?? [];
      pool.push(row);
      this.pools.set(key, pool);
    }
  }

  has(key: string, tier = 0): boolean {
    return this.pools.has(this.poolKey(key, tier, GENERIC_SPEAKER, null));
  }

  pick(rng: Rng, key: string, tier = 0, speaker = GENERIC_SPEAKER, personality: string | null = null): PickedLine | null {
    const candidates = [
      this.poolKey(key, tier, speaker, null),
      personality ? this.poolKey(key, tier, GENERIC_SPEAKER, personality) : null,
      this.poolKey(key, tier, GENERIC_SPEAKER, null),
    ];
    for (const candidate of candidates) {
      const pool = candidate ? this.pools.get(candidate) : undefined;
      if (!pool || pool.length === 0) continue;
      const lastText = this.last.get(candidate!);
      const choices = pool.length > 1 ? pool.filter((r) => r.text !== lastText) : pool;
      const row = pick(rng, choices)!;
      this.last.set(candidate!, row.text);
      return { text: row.text, expression: row.expression };
    }
    return null;
  }

  private poolKey(key: string, tier: number, speaker: string, personality: string | null): string {
    return `${key}|${tier}|${speaker}|${personality ?? ''}`;
  }
}

export async function loadLinePicker(pool: pg.Pool, locale = 'en'): Promise<LinePicker> {
  const res = await pool.query<LineRow>(
    `SELECT l.condition_key, l.tier, s.speaker_name AS speaker, l.personality_tag,
            l.expression, l.text, l.locale
     FROM presentation.diegetic_lines l
     JOIN presentation.speakers s ON s.id = l.speaker_id`,
  );
  return new LinePicker(res.rows, locale);
}
