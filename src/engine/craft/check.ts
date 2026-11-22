import type { RecipeIngredient } from "../../schemas/recipeSchema";
import { countItem, isDefined } from "../inventory";
import type { InventoryState } from "../inventory";
import type { CraftCheck, MissingIngredient, RecipeInput } from "./types";

function missingOf(
  inventory: InventoryState,
  ingredient: RecipeIngredient,
): MissingIngredient | undefined {
  const owned = countItem(inventory, ingredient.itemId);
  if (owned >= ingredient.quantity) return undefined;
  return { itemId: ingredient.itemId, needed: ingredient.quantity, owned };
}

function timesFor(inventory: InventoryState, ingredient: RecipeIngredient): number {
  return Math.floor(countItem(inventory, ingredient.itemId) / ingredient.quantity);
}

/** Vérifie chaque ingrédient ; `missing` ne contient que les manques. */
export function canCraft(input: RecipeInput): CraftCheck {
  const missing = input.recipe.ingredients
    .map((ingredient) => missingOf(input.inventory, ingredient))
    .filter(isDefined);
  return { ok: missing.length === 0, missing };
}

/** Combien de fabrications le stock actuel autorise (min sur les ingrédients). */
export function craftableCount(input: RecipeInput): number {
  const counts = input.recipe.ingredients.map((ingredient) =>
    timesFor(input.inventory, ingredient),
  );
  if (counts.length === 0) return 0;
  return Math.min(...counts);
}
