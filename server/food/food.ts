import type { BalanceConfig } from '../config/balance.ts';
import type { ItemDef } from '../inventory/items.ts';

// Food (SYSTEMS.md): one meal at a time, a hidden effect that lasts a set time from when it was eaten (no timer),
// no hunger, no penalty. Only its start and end are ever heard.

export type Meal = { item: string; eatenAt: number };
export type CostMult = { stamina: number; mana: number };

const MINUTE_MS = 60_000;

export const mealEnds = (cfg: BalanceConfig, meal: Meal) => meal.eatenAt + cfg.food.durationMinutes * MINUTE_MS * cfg.worldTimeScale;
export const mealActive = (cfg: BalanceConfig, meal: Meal | null, now: number): meal is Meal => !!meal && now < mealEnds(cfg, meal);

// Can be eaten: food marked edible (tainted and rotten meat are not).
export const canEat = (def: ItemDef | undefined) => def?.edible === true;

// What a meal does to move costs in battle (1 = nothing).
export function mealCosts(def: ItemDef | undefined): CostMult {
  return { stamina: def?.meal?.stamina_cost ?? 1, mana: def?.meal?.mana_cost ?? 1 };
}
