import type { RecipeDef } from "../../schemas/recipeSchema";
import { canCraft, craftableCount } from "./check";
import { isRecipeKnown } from "./craft";
import type { AvailableRecipe, CraftContext } from "./types";

function isAvailable(context: CraftContext, recipe: RecipeDef): boolean {
  if (!isRecipeKnown({ recipe, knownRecipeIds: context.knownRecipeIds })) return false;
  return canCraft({ recipe, inventory: context.inventory }).ok;
}

function describeRecipe(context: CraftContext, recipe: RecipeDef): AvailableRecipe {
  const recipeInput = { recipe, inventory: context.inventory };
  return { recipe, craftableCount: craftableCount(recipeInput) };
}

/** Recettes connues ET craftables avec le stock courant. */
export function availableRecipes(context: CraftContext): AvailableRecipe[] {
  return context.recipes
    .filter((recipe) => isAvailable(context, recipe))
    .map((recipe) => describeRecipe(context, recipe));
}
