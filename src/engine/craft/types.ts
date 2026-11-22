import type { RecipeDef } from "../../schemas/recipeSchema";
import type { InventoryState } from "../inventory";

export interface CraftContext {
  recipes: readonly RecipeDef[];
  inventory: InventoryState;
  knownRecipeIds: readonly string[];
}

export interface MissingIngredient {
  itemId: string;
  needed: number;
  owned: number;
}

export interface CraftCheck {
  ok: boolean;
  missing: MissingIngredient[];
}

export interface RecipeInput {
  recipe: RecipeDef;
  inventory: InventoryState;
}

export interface KnownRecipeInput {
  recipe: RecipeDef;
  knownRecipeIds: readonly string[];
}

export interface CraftOnceResult {
  inventory: InventoryState;
  crafted: boolean;
}

export interface CraftManyInput extends RecipeInput {
  times: number;
}

export interface CraftManyResult {
  inventory: InventoryState;
  craftedCount: number;
}

export interface AvailableRecipe {
  recipe: RecipeDef;
  craftableCount: number;
}
