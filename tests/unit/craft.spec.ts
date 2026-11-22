import { describe, expect, it } from "vitest";
import {
  availableRecipes,
  canCraft,
  craftMany,
  craftOnce,
  craftableCount,
  findRecipe,
  isRecipeKnown,
} from "../../src/engine/craft";
import type { InventoryState } from "../../src/engine/inventory";
import type { RecipeDef } from "../../src/schemas/recipeSchema";

const RAGOUT: RecipeDef = {
  id: "recette_test_ragout",
  resultItemId: "ragout_test",
  resultQuantity: 1,
  ingredients: [
    { itemId: "ferraille", quantity: 2 },
    { itemId: "ecrou", quantity: 1 },
  ],
  craftLevel: 1,
  description: "Un ragoût de test, tiède par principe et froid par habitude.",
};

const TRIPLE: RecipeDef = {
  id: "recette_test_triple",
  resultItemId: "boulon_test",
  resultQuantity: 3,
  ingredients: [{ itemId: "soupe", quantity: 1 }],
  craftLevel: 2,
  description: "Trois boulons pour le prix d'une soupe, ce qui n'arrange personne.",
};

const inventoryOf = (stacks: { itemId: string; quantity: number }[]): InventoryState => ({
  stacks,
  equipment: {},
});

const FULL = inventoryOf([
  { itemId: "ferraille", quantity: 5 },
  { itemId: "ecrou", quantity: 2 },
  { itemId: "soupe", quantity: 1 },
]);

const snapshot = (inventory: InventoryState): InventoryState => structuredClone(inventory);

describe("findRecipe", () => {
  it("retourne la recette dont l'id correspond", () => {
    expect(findRecipe([RAGOUT, TRIPLE], RAGOUT.id)).toBe(RAGOUT);
  });

  it("retourne null pour un id inconnu", () => {
    expect(findRecipe([RAGOUT], "recette_fantome")).toBeNull();
  });
});

describe("canCraft", () => {
  it("accepte quand tous les ingrédients sont possédés", () => {
    expect(canCraft({ recipe: RAGOUT, inventory: FULL })).toEqual({ ok: true, missing: [] });
  });

  it("accepte quand le stock est exactement le compte", () => {
    const exact = inventoryOf([
      { itemId: "ferraille", quantity: 2 },
      { itemId: "ecrou", quantity: 1 },
    ]);
    expect(canCraft({ recipe: RAGOUT, inventory: exact }).ok).toBe(true);
  });

  it("signale un ingrédient manquant avec needed et owned", () => {
    const short = inventoryOf([{ itemId: "ferraille", quantity: 2 }]);
    expect(canCraft({ recipe: RAGOUT, inventory: short })).toEqual({
      ok: false,
      missing: [{ itemId: "ecrou", needed: 1, owned: 0 }],
    });
  });

  it("liste plusieurs manques et un stock partiel", () => {
    const short = inventoryOf([{ itemId: "ferraille", quantity: 1 }]);
    expect(canCraft({ recipe: RAGOUT, inventory: short }).missing).toEqual([
      { itemId: "ferraille", needed: 2, owned: 1 },
      { itemId: "ecrou", needed: 1, owned: 0 },
    ]);
  });
});

describe("isRecipeKnown", () => {
  it("reconnaît une recette apprise", () => {
    expect(isRecipeKnown({ recipe: RAGOUT, knownRecipeIds: [RAGOUT.id] })).toBe(true);
  });

  it("refuse une recette non apprise", () => {
    expect(isRecipeKnown({ recipe: RAGOUT, knownRecipeIds: [TRIPLE.id] })).toBe(false);
  });
});

describe("craftOnce", () => {
  it("déduit les ingrédients et ajoute le résultat", () => {
    const before = snapshot(FULL);
    const result = craftOnce({ recipe: RAGOUT, inventory: FULL });
    expect(result.crafted).toBe(true);
    expect(result.inventory.stacks).toEqual([
      { itemId: "ferraille", quantity: 3 },
      { itemId: "ecrou", quantity: 1 },
      { itemId: "soupe", quantity: 1 },
      { itemId: "ragout_test", quantity: 1 },
    ]);
    expect(FULL).toEqual(before);
  });

  it("rend l'inventaire d'entrée par identité en cas d'échec", () => {
    const empty = inventoryOf([]);
    const result = craftOnce({ recipe: RAGOUT, inventory: empty });
    expect(result.crafted).toBe(false);
    expect(result.inventory).toBe(empty);
  });

  it("respecte resultQuantity", () => {
    const result = craftOnce({ recipe: TRIPLE, inventory: FULL });
    const stack = result.inventory.stacks.find((entry) => entry.itemId === "boulon_test");
    expect(stack?.quantity).toBe(3);
  });
});

describe("craftMany", () => {
  it("répète la fabrication jusqu'au nombre demandé", () => {
    const before = snapshot(FULL);
    const result = craftMany({ recipe: RAGOUT, inventory: FULL, times: 2 });
    expect(result.craftedCount).toBe(2);
    expect(result.inventory.stacks).toEqual([
      { itemId: "ferraille", quantity: 1 },
      { itemId: "soupe", quantity: 1 },
      { itemId: "ragout_test", quantity: 2 },
    ]);
    expect(FULL).toEqual(before);
  });

  it("s'arrête dès que le stock est épuisé", () => {
    const result = craftMany({ recipe: RAGOUT, inventory: FULL, times: 3 });
    expect(result.craftedCount).toBe(2);
  });

  it("rend l'inventaire par identité quand times vaut 0", () => {
    const result = craftMany({ recipe: RAGOUT, inventory: FULL, times: 0 });
    expect(result.craftedCount).toBe(0);
    expect(result.inventory).toBe(FULL);
  });
});

describe("craftableCount", () => {
  it("prend le minimum sur les ingrédients", () => {
    expect(craftableCount({ recipe: RAGOUT, inventory: FULL })).toBe(2);
  });

  it("vaut 0 quand un ingrédient manque", () => {
    const short = inventoryOf([{ itemId: "ferraille", quantity: 10 }]);
    expect(craftableCount({ recipe: RAGOUT, inventory: short })).toBe(0);
  });
});

describe("availableRecipes", () => {
  it("exclut les recettes non connues", () => {
    const available = availableRecipes({
      recipes: [RAGOUT, TRIPLE],
      inventory: FULL,
      knownRecipeIds: [RAGOUT.id],
    });
    expect(available.map((entry) => entry.recipe.id)).toEqual([RAGOUT.id]);
  });

  it("exclut les recettes non craftables", () => {
    const available = availableRecipes({
      recipes: [RAGOUT, TRIPLE],
      inventory: inventoryOf([{ itemId: "soupe", quantity: 1 }]),
      knownRecipeIds: [RAGOUT.id, TRIPLE.id],
    });
    expect(available.map((entry) => entry.recipe.id)).toEqual([TRIPLE.id]);
  });

  it("annonce le craftableCount de chaque recette connue", () => {
    const available = availableRecipes({
      recipes: [RAGOUT, TRIPLE],
      inventory: FULL,
      knownRecipeIds: [RAGOUT.id, TRIPLE.id],
    });
    expect(available.map((entry) => entry.craftableCount)).toEqual([2, 1]);
  });
});
