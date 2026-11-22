import { countItem, removeItem } from "./stack";
import type { UseConsumableInput, UseConsumableResult } from "./types";

function computeHeal(currentHp: number, maxHp: number, heal: number | undefined): number {
  const missing = Math.max(0, maxHp - currentHp);
  return Math.min(heal ?? 0, missing);
}

function isUsable(input: UseConsumableInput, healed: number): boolean {
  return healed > 0 && countItem(input.inventory, input.item.id) > 0;
}

/**
 * Consomme une unité si elle est en sac et si elle soigne réellement : à PV
 * plein (ou avec `heal <= 0`) rien n'est consommé. Le soin est borné à
 * `maxHp - currentHp`.
 */
export function useConsumable(input: UseConsumableInput): UseConsumableResult {
  const healed = computeHeal(input.currentHp, input.maxHp, input.item.heal);
  if (!isUsable(input, healed)) return { inventory: input.inventory, healed: 0, hp: input.currentHp };
  const inventory = removeItem({ inventory: input.inventory, itemId: input.item.id, quantity: 1 });
  return { inventory, healed, hp: input.currentHp + healed };
}
