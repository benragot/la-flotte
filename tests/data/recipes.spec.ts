import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { countItem } from "../../src/engine/inventory";
import type { InventoryState } from "../../src/engine/inventory";
import { canCraft, craftOnce } from "../../src/engine/craft";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import type { ItemDef } from "../../src/schemas/itemSchema";
import { parseRecipesYaml, recipesFileSchema } from "../../src/schemas/recipeSchema";
import type { RecipeDef } from "../../src/schemas/recipeSchema";

const DATA_DIR = join(process.cwd(), "data");
const SNAKE_CASE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const MIN_RECIPES = 8;
const MAX_RECIPES = 10;

const read = (file: string): string => readFileSync(join(DATA_DIR, file), "utf8");
const loadRecipes = (): RecipeDef[] => parseRecipesYaml(read("recipes.yaml"));
const loadItems = (): ItemDef[] => parseItemsYaml(read("items.yaml"));

const ingredientIds = (recipe: RecipeDef): string[] => recipe.ingredients.map((entry) => entry.itemId);

const inventoryFrom = (recipe: RecipeDef): InventoryState => ({
  stacks: recipe.ingredients.map((entry) => ({ itemId: entry.itemId, quantity: entry.quantity })),
  equipment: {},
});

const itemById = (items: readonly ItemDef[], id: string): ItemDef | undefined =>
  items.find((item) => item.id === id);

describe("recipes.yaml", () => {
  it("contient entre 8 et 10 recettes aux ids uniques en snake_case", () => {
    const recipes = loadRecipes();
    expect(recipes.length).toBeGreaterThanOrEqual(MIN_RECIPES);
    expect(recipes.length).toBeLessThanOrEqual(MAX_RECIPES);
    const ids = recipes.map((recipe) => recipe.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(SNAKE_CASE));
  });

  it("fait pointer chaque résultat vers un item existant", () => {
    const itemIds = new Set(loadItems().map((item) => item.id));
    loadRecipes().forEach((recipe) => {
      expect(itemIds.has(recipe.resultItemId), `${recipe.resultItemId} absent d'items.yaml`).toBe(true);
    });
  });

  it("fait pointer chaque ingrédient vers un item existant, sans doublon", () => {
    const itemIds = new Set(loadItems().map((item) => item.id));
    loadRecipes().forEach((recipe) => {
      const ids = ingredientIds(recipe);
      ids.forEach((id) => expect(itemIds.has(id), `${id} absent d'items.yaml`).toBe(true));
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  it("borne le niveau d'artisanat entre 1 et 50 et les quantités à au moins 1", () => {
    loadRecipes().forEach((recipe) => {
      expect(recipe.craftLevel).toBeGreaterThanOrEqual(1);
      expect(recipe.craftLevel).toBeLessThanOrEqual(50);
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      recipe.ingredients.forEach((entry) => expect(entry.quantity).toBeGreaterThanOrEqual(1));
      expect(recipe.resultQuantity).toBeGreaterThanOrEqual(1);
    });
  });

  it("couvre au moins un consommable, une pièce de panoplie et une arme", () => {
    const items = loadItems();
    const categories = loadRecipes().map((recipe) => itemById(items, recipe.resultItemId));
    const weapons = categories.filter((item) => item?.category === "equipment" && item.slot === "weapon");
    const setPieces = categories.filter((item) => item?.category === "equipment" && item.setId !== undefined);
    expect(categories.filter((item) => item?.category === "consumable").length).toBeGreaterThan(0);
    expect(setPieces.length).toBeGreaterThan(0);
    expect(weapons.length).toBeGreaterThan(0);
  });

  it("permet un aller-retour craftOnce sur une recette réelle", () => {
    const [recipe] = loadRecipes();
    if (recipe === undefined) throw new Error("aucune recette dans recipes.yaml");
    const inventory = inventoryFrom(recipe);
    expect(canCraft({ recipe, inventory }).ok).toBe(true);
    const result = craftOnce({ recipe, inventory });
    expect(result.crafted).toBe(true);
    expect(countItem(result.inventory, recipe.resultItemId)).toBe(recipe.resultQuantity);
    ingredientIds(recipe).forEach((id) => expect(countItem(result.inventory, id)).toBe(0));
  });
});

describe("rejets Zod des recettes", () => {
  const base: RecipeDef = {
    id: "recette_de_test",
    resultItemId: "ferraille_rouillee",
    resultQuantity: 1,
    ingredients: [{ itemId: "plume_mazoutee", quantity: 1 }],
    craftLevel: 1,
    description: "Une recette de test qui ne fabrique rien d'utile.",
  };

  it("refuse un id de recette dupliqué", () => {
    expect(() => recipesFileSchema.parse({ recipes: [base, { ...base }] })).toThrow(/dupliqué/);
  });

  it("refuse un ingrédient dupliqué dans une recette", () => {
    const ingredients = [
      { itemId: "plume_mazoutee", quantity: 1 },
      { itemId: "plume_mazoutee", quantity: 2 },
    ];
    expect(() => recipesFileSchema.parse({ recipes: [{ ...base, ingredients }] })).toThrow(/dupliqué/);
  });

  it("refuse un craftLevel hors bornes", () => {
    expect(() => recipesFileSchema.parse({ recipes: [{ ...base, craftLevel: 0 }] })).toThrow(/craftLevel/);
  });

  it("refuse une recette sans ingrédient", () => {
    expect(() => recipesFileSchema.parse({ recipes: [{ ...base, ingredients: [] }] })).toThrow(/ingredients/);
  });

  it("applique resultQuantity par défaut à 1", () => {
    const parsed = recipesFileSchema.parse({ recipes: [{ ...base, resultQuantity: undefined }] });
    expect(parsed.recipes[0]?.resultQuantity).toBe(1);
  });
});
