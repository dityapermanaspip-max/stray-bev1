// One change at a time per player. Every action that loads a player, changes them and saves them back
// (shop, craft, inn, loadout, gear, a battle's start and end) runs through withEntity, so two quick clicks or
// two tabs can never both act on the same old bag. A player in a battle is "fighting": the battle saved their
// bag at its start and writes it back at its end, so nothing else may touch them until then.
// In memory: this holds for one game server process (the DB stays the truth; a second process would need row locks).

const tails = new Map<string, Promise<unknown>>();
const fighting = new Set<string>();

export function withEntity<T>(entityId: string, work: () => Promise<T> | T): Promise<T> {
  const run = (tails.get(entityId) ?? Promise.resolve()).catch(() => undefined).then(work);
  tails.set(entityId, run);
  const clear = () => {
    if (tails.get(entityId) === run) tails.delete(entityId);
  };
  run.then(clear, clear);
  return run;
}

export const isFighting = (entityId: string) => fighting.has(entityId);
export const startFighting = (entityId: string) => void fighting.add(entityId);
export const stopFighting = (entityId: string) => void fighting.delete(entityId);
