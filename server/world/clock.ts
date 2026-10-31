// The world clock. One world hour is world_time_scale real hours. The DB keeps how many world hours have run and
// when the last one was due; the server runs whatever is due, catching up at most catch_up_hours after a stop.

export const worldHourMs = (timeScale: number) => 3_600_000 * timeScale;

// World hours due since lastAt, how many to run now, and the new lastAt. Hours past the cap are skipped
// (the world does not replay a long stop), keeping the part of an hour already gone.
export function dueHours(now: number, lastAt: number, hourMs: number, cap: number): { run: number; lastAt: number } {
  const due = Math.floor((now - lastAt) / hourMs);
  if (due <= 0) return { run: 0, lastAt };
  if (due <= cap) return { run: due, lastAt: lastAt + due * hourMs };
  return { run: cap, lastAt: now - ((now - lastAt) % hourMs) };
}

// How many times a rule with this interval (world hours) fires at world hour h (h >= 1).
export const firesAt = (intervalHours: number, h: number) =>
  intervalHours > 0 ? Math.floor(h / intervalHours) - Math.floor((h - 1) / intervalHours) : 0;

// Rounds a fraction up by chance (2.3 -> 2, or 3 three times in ten), so small per-tick rates still add up.
export const chanceRound = (rng: () => number, x: number) => {
  const whole = Math.floor(Math.max(0, x));
  return whole + (rng() < Math.max(0, x) - whole ? 1 : 0);
};
