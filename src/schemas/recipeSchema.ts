import yaml from "js-yaml";
import { z } from "zod";
import { checkUniqueIds, itemIdSchema } from "./itemSchema";

const MIN_CRAFT_LEVEL = 1;
const MAX_CRAFT_LEVEL = 50;
const MIN_INGREDIENTS = 1;
const DEFAULT_RESULT_QUANTITY = 1;

type IssueSink = z.RefinementCtx;

function quantitySchema(): z.ZodNumber {
  return z.number().int().min(1);
}

export const recipeIngredientSchema = z.object({
  itemId: itemIdSchema,
  quantity: quantitySchema(),
});

export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;

function checkDistinctIngredients(ingredients: readonly RecipeIngredient[], ctx: IssueSink): void {
  checkUniqueIds(
    ingredients.map((ingredient) => ingredient.itemId),
    ctx,
    "ingredients",
  );
}

export const recipeSchema = z
  .object({
    id: itemIdSchema,
    resultItemId: itemIdSchema,
    resultQuantity: quantitySchema().default(DEFAULT_RESULT_QUANTITY),
    ingredients: z.array(recipeIngredientSchema).min(MIN_INGREDIENTS),
    craftLevel: z.number().int().min(MIN_CRAFT_LEVEL).max(MAX_CRAFT_LEVEL),
    description: z.string().min(1),
  })
  .superRefine((recipe, ctx) => {
    checkDistinctIngredients(recipe.ingredients, ctx);
  });

export type RecipeDef = z.infer<typeof recipeSchema>;

export const recipesFileSchema = z
  .object({ recipes: z.array(recipeSchema).min(MIN_INGREDIENTS) })
  .superRefine((file, ctx) => {
    checkUniqueIds(
      file.recipes.map((recipe) => recipe.id),
      ctx,
      "recipes",
    );
  });

export function parseRecipesYaml(raw: string): RecipeDef[] {
  return recipesFileSchema.parse(yaml.load(raw)).recipes;
}
