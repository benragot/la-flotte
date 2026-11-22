import type { RecipeDef, RecipeIngredient } from "../../schemas/recipeSchema";
import { addItem, removeItem } from "../inventory";
import type { InventoryState } from "../inventory";
import { canCraft } from "./check";
import type {
  CraftManyInput,
  CraftManyResult,
  CraftOnceResult,
  KnownRecipeInput,
  RecipeInput,
} from "./types";

export function findRecipe(
  recipes: readonly RecipeDef[],
  recipeId: string,
): RecipeDef | null {
  return recipes.find((recipe) => recipe.id === recipeId) ?? null;
}

export function isRecipeKnown(input: KnownRecipeInput): boolean {
  return input.knownRecipeIds.includes(input.recipe.id);
}

function takeIngredient(
  inventory: InventoryState,
  ingredient: RecipeIngredient,
): InventoryState {
  return removeItem({ inventory, itemId: ingredient.itemId, quantity: ingredient.quantity });
}

function withdraw(input: RecipeInput): InventoryState {
  return input.recipe.ingredients.reduce(takeIngredient, input.inventory);
}

/** Fabrique une fois ; rend l'inventaire d'entrée par identité en cas d'échec. */
export function craftOnce(input: RecipeInput): CraftOnceResult {
  if (!canCraft(input).ok) return { inventory: input.inventory, crafted: false };
  const inventory = addItem({
    inventory: withdraw(input),
    itemId: input.recipe.resultItemId,
    quantity: input.recipe.resultQuantity,
  });
  return { inventory, crafted: true };
}

interface CraftLoop {
  inventory: InventoryState;
  craftedCount: number;
}

function canContinue(input: CraftManyInput, state: CraftLoop): boolean {
  if (state.craftedCount >= input.times) return false;
  return canCraft({ recipe: input.recipe, inventory: state.inventory }).ok;
}

function craftStep(input: CraftManyInput, state: CraftLoop): CraftLoop {
  const once = craftOnce({ recipe: input.recipe, inventory: state.inventory });
  return { inventory: once.inventory, craftedCount: state.craftedCount + 1 };
}

/** Fabrique au plus `times` fois et s'arrête dès que le stock manque. */
export function craftMany(input: CraftManyInput): CraftManyResult {
  let state: CraftLoop = { inventory: input.inventory, craftedCount: 0 };
  while (canContinue(input, state)) {
    state = craftStep(input, state);
  }
  return state;
}
