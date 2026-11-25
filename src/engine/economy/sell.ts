import { countItem, removeItem } from "../inventory";
import type { InventoryState } from "../inventory";

export interface SellItemInput {
  inventory: InventoryState;
  kamas: number;
  itemId: string;
  /** Prix unitaire lu dans `data/items.yaml` ; `undefined` = objet invendable. */
  price: number | undefined;
  quantity: number;
}

export interface SellItemResult {
  inventory: InventoryState;
  kamas: number;
  /** Unités effectivement vendues ; 0 pour tout refus. */
  sold: number;
  /** Kamas crédités ; 0 pour tout refus. */
  earned: number;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/** Le prix reste une donnée : absent, fractionnaire ou négatif ⇒ invendable. */
function isUnitPrice(price: number | undefined): price is number {
  return price !== undefined && Number.isInteger(price) && price >= 0;
}

function hasStock(input: SellItemInput): boolean {
  return countItem(input.inventory, input.itemId) >= input.quantity;
}

/** Prix unitaire si la vente est possible, `null` sinon (refus unique). */
function salePrice(input: SellItemInput): number | null {
  if (!isPositiveInteger(input.quantity) || !isUnitPrice(input.price)) return null;
  return hasStock(input) ? input.price : null;
}

/**
 * Kamas entiers sûrs uniquement : un total qui dépasse `MAX_SAFE_INTEGER` est
 * refusé (et non arrondi silencieusement), tout comme une bourse négative.
 */
function isCreditable(kamas: number, earned: number): boolean {
  return Number.isSafeInteger(kamas) && kamas >= 0 && Number.isSafeInteger(kamas + earned);
}

function unchanged(input: SellItemInput): SellItemResult {
  return { inventory: input.inventory, kamas: input.kamas, sold: 0, earned: 0 };
}

function soldResult(input: SellItemInput, earned: number): SellItemResult {
  const options = { inventory: input.inventory, itemId: input.itemId, quantity: input.quantity };
  const inventory = removeItem(options);
  return { inventory, kamas: input.kamas + earned, sold: input.quantity, earned };
}

/**
 * Vend `quantity` unités de `itemId` au prix unitaire `price` fourni par
 * l'appelant (le catalogue `data/items.yaml`). Tout refus — objet non possédé,
 * quantité absente/négative/fractionnaire, prix inconnu, total de kamas non sûr
 * — rend l'état d'entrée par identité, sans vente partielle.
 */
export function sellItem(input: SellItemInput): SellItemResult {
  const price = salePrice(input);
  if (price === null) return unchanged(input);
  const earned = price * input.quantity;
  if (!isCreditable(input.kamas, earned)) return unchanged(input);
  return soldResult(input, earned);
}
