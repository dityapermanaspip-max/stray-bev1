import { loadLoot } from '../data/loot_repo.ts';
import { readClock, runWorldHour, setClock, type TickWorld } from '../data/tick_repo.ts';
import { createRng } from '../util/rng.ts';
import { reloadVices } from '../vice/vice_finder.ts';
import { closeRoundIfDue } from '../boss/boss_repo.ts';
import { dueHours, worldHourMs } from '../world/clock.ts';
import type { TickReport } from '../world/town_tick.ts';
import type { GameWorld } from './world.ts';

// The world ticker: every check_seconds it runs the world hours that are due (population rules, town ticks),
// one transaction per hour, never two runs at once. After a stop it catches up at most catch_up_hours.
// Counts only: field rooms read fresh counts when someone joins, shops read fresh stock for every view.

export async function startTicker(world: GameWorld): Promise<() => void> {
  const { cfg } = world.data;
  const w: TickWorld = {
    cfg, catalog: world.catalog, loot: await loadLoot(world.pool), recipes: world.recipes, biomes: world.fields.biomes,
    rng: createRng(Date.now() >>> 0),
  };
  const hourMs = worldHourMs(cfg.worldTimeScale);
  let busy = false;
  let ended = false; // the round's closing period is over: no more world hours
  let told = false;

  const check = async () => {
    if (busy) return;
    busy = true;
    try {
      if (ended || (ended = await closeRoundIfDue(world.pool, world.roundId))) {
        if (!told) console.log('This round has ended (its closing period is over). Start a new world (npm run world:new) and restart the game server.');
        return void (told = true);
      }
      const clock = await readClock(world.pool, world.roundId);
      if (clock.at === null) return void (await setClock(world.pool, world.roundId, clock.hours, Date.now())); // the clock starts now
      const due = dueHours(Date.now(), clock.at, hourMs, cfg.clock.catchUpHours);
      for (let i = 1; i <= due.run; i++) {
        const reports = await runWorldHour(world.pool, w, world.roundId, clock.hours + i);
        await setClock(world.pool, world.roundId, clock.hours + i, i === due.run ? due.lastAt : clock.at + i * hourMs);
        if (due.run === 1) logHour(clock.hours + i, reports);
      }
      if (due.run > 0) await reloadVices(world.pool, world.roundId); // invasions move vices
      if (due.run > 1) console.log(`World ticker caught up ${due.run} world hours (to hour ${clock.hours + due.run}).`);
    } catch (err) {
      console.error(`world tick failed: ${(err as Error).message}`);
    } finally {
      busy = false;
    }
  };

  await check();
  const timer = setInterval(() => void check(), cfg.clock.checkSeconds * 1000);
  return () => clearInterval(timer);
}

// Dev log on the server console only (hidden numbers never reach a client).
function logHour(hour: number, reports: Map<string, TickReport>) {
  for (const [ref, r] of reports) {
    console.log(`hour ${hour} town ${ref.slice(0, 8)}: used ${r.used}, paid ${r.paid}, wages ${r.wages}, caught ${r.caught}, logs ${r.logs}, batches ${r.batches}`);
  }
}
