import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addItem, countItem } from "../../src/engine/inventory";
import type { InventoryState } from "../../src/engine/inventory";
import { craftMany } from "../../src/engine/craft";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import type { ItemDef } from "../../src/schemas/itemSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseRecipesYaml } from "../../src/schemas/recipeSchema";
import type { RecipeDef } from "../../src/schemas/recipeSchema";
import { parseSpawnsYaml } from "../../src/schemas/spawnSchema";

const DATA_DIR = join(process.cwd(), "data");
const KEY_ID = "cle_donjon_ile_de_la_ferraille";
const KEY_RECIPE_ID = "recette_cle_donjon_ile_de_la_ferraille";

/** Valeurs du §4 de `docs/design/islands/ile_de_la_ferraille.md`. */
const INGREDIENTS = [
  { id: "fer_pince_de_douze", quantity: 3, sellPrice: 8 },
  { id: "fer_boulon_sans_fin", quantity: 3, sellPrice: 12 },
  { id: "fer_goutte_mazout", quantity: 2, sellPrice: 4 },
] as const;

const read = (file: string): string => readFileSync(join(DATA_DIR, file), "utf8");
const loadItems = (): ItemDef[] => parseItemsYaml(read("items.yaml"));
const loadRecipes = (): RecipeDef[] => parseRecipesYaml(read("recipes.yaml"));
const loadMonsters = () => parseMonstersYaml(read("monsters.yaml"));

const itemById = (items: readonly ItemDef[], id: string): ItemDef | undefined =>
  items.find((item) => item.id === id);

const recipeOfKey = (recipes: readonly RecipeDef[]): RecipeDef => {
  const recipe = recipes.find((entry) => entry.resultItemId === KEY_ID);
  if (recipe === undefined) throw new Error(`aucune recette ne produit ${KEY_ID}`);
  return recipe;
};

const sortedPairs = (pairs: ReadonlyArray<{ itemId: string; quantity: number }>) =>
  [...pairs].map(({ itemId, quantity }) => `${itemId}x${quantity}`).sort();

const expectedPairs = sortedPairs(INGREDIENTS.map((entry) => ({ itemId: entry.id, quantity: entry.quantity })));

const farmInventory = (): InventoryState =>
  INGREDIENTS.reduce<InventoryState>(
    (inventory, entry) => addItem({ inventory, itemId: entry.id, quantity: entry.quantity }),
    { stacks: [], equipment: {} },
  );

const lootItemIdsOf = (monsters: ReturnType<typeof loadMonsters>): string[] =>
  monsters.flatMap((monster) => monster.loot.map((entry) => entry.itemId));

/** `starting` n'existe que sur les équipements : on lit le champ brut, sans filtre de catégorie. */
const isStarting = (item: ItemDef | undefined): boolean =>
  (item as { starting?: boolean } | undefined)?.starting === true;

const droppersOf = (itemId: string): string[] =>
  loadMonsters()
    .filter((monster) => monster.loot.some((entry) => entry.itemId === itemId))
    .map((monster) => monster.id);

/** Monstres réellement rencontrés hors donjon (table de spawn d'exploration). */
const explorationMonsterIds = (): Set<string> =>
  new Set(parseSpawnsYaml(read("spawns.yaml")).flatMap((zone) => zone.monsters.map((entry) => entry.monsterId)));

describe("clef du donjon de la Ferraille — ingrédients du §4", () => {
  it.each(INGREDIENTS)("déclare $id en ressource à $sellPrice kamas", ({ id, sellPrice }) => {
    const item = itemById(loadItems(), id);
    expect(item, `${id} absent d'items.yaml`).toBeDefined();
    expect(item?.category).toBe("resource");
    expect(item?.sellPrice).toBe(sellPrice);
  });
});

describe("clef du donjon de la Ferraille — recette du §7", () => {
  it("produit exactement une clef", () => {
    const recipe = recipeOfKey(loadRecipes());
    expect(recipe.resultItemId).toBe(KEY_ID);
    expect(recipe.resultQuantity).toBe(1);
  });

  it("consomme exactement pince×3, boulon×3 et goutte×2", () => {
    expect(sortedPairs(recipeOfKey(loadRecipes()).ingredients)).toEqual(expectedPairs);
  });

  it("nomme la recette recette_cle_donjon_ile_de_la_ferraille", () => {
    expect(recipeOfKey(loadRecipes()).id).toBe(KEY_RECIPE_ID);
  });
});

describe("clef du donjon de la Ferraille — craft réel", () => {
  it("craftMany consomme tout l'inventaire et pose la clef au sac", () => {
    const recipe = recipeOfKey(loadRecipes());
    const result = craftMany({ recipe, inventory: farmInventory(), times: 1 });
    expect(result.craftedCount).toBe(1);
    expect(countItem(result.inventory, KEY_ID)).toBe(1);
    INGREDIENTS.forEach((entry) => expect(countItem(result.inventory, entry.id)).toBe(0));
  });
});

describe("clef du donjon de la Ferraille — chaîne de données", () => {
  it("fait lâcher chaque ingrédient par au moins un monstre", () => {
    const loot = lootItemIdsOf(loadMonsters());
    INGREDIENTS.forEach((entry) => {
      expect(loot, `${entry.id} n'a aucune source de butin`).toContain(entry.id);
    });
  });

  // 5B-g est livrée : le constat « tous les lâcheurs sont en donjon » est
  // retourné. L'assertion porte désormais sur l'exploration, pour qu'un futur
  // lâcheur extérieur reste une amélioration et non une régression.
  it("trouve pour chaque ingrédient un lâcheur rencontré hors donjon", () => {
    const spawned = explorationMonsterIds();
    INGREDIENTS.forEach((entry) => {
      const farmable = droppersOf(entry.id).filter((id) => spawned.has(id));
      expect(farmable, `${entry.id} n'a aucun lâcheur dans spawns.yaml`).not.toEqual([]);
    });
  });

  it("ne marque jamais une clef comme item de départ", () => {
    const startingKeys = loadItems().filter(isStarting).filter((item) => item.category === "key");
    expect(startingKeys.map((item) => item.id)).toEqual([]);
    expect(isStarting(itemById(loadItems(), KEY_ID))).toBe(false);
  });
});
