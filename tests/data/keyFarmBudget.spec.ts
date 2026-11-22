import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeDropChance } from "../../src/engine/economy";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseRecipesYaml } from "../../src/schemas/recipeSchema";
import type { RecipeDef, RecipeIngredient } from "../../src/schemas/recipeSchema";
import { parseSpawnsYaml } from "../../src/schemas/spawnSchema";
import type { SpawnZoneDef } from "../../src/schemas/spawnSchema";

/**
 * BUDGET DE FARM DES CLEFS — décision propriétaire D07.
 *
 * Une clef de donjon doit coûter **entre 5 et 10 rencontres en moyenne**. Ce test
 * est le garde-fou de la décision : il parcourt TOUTES les recettes dont le
 * résultat a `category: key` (aucun id de clef écrit ici), lit les poids de
 * `spawns.yaml`, les taux de `monsters.yaml` et les quantités de `recipes.yaml`,
 * puis calcule pour chaque ingrédient :
 *
 *     espérance_i = quantité_i / (part_de_spawn_i × taux_de_drop_i)
 *
 * APPROXIMATIONS ASSUMÉES (elles vont dans le sens du joueur, et c'est voulu :
 * le test ne doit jamais laisser passer un farm plus long que mesuré) :
 *   1. On prend le **max des espérances par ingrédient**, jamais leur somme : les
 *      rencontres sont PARTAGÉES (un combat ne donne qu'un monstre), donc
 *      additionner les chasses compterait plusieurs fois les mêmes combats.
 *   2. On prend la **meilleure zone** pour chaque ingrédient : c'est le
 *      comportement d'un joueur qui choisit sa plage, pas d'un joueur qui insiste
 *      sur la mauvaise (`spawns.yaml` déclare une zone par map).
 *   3. On prend l'**espérance**, pas la distribution : la variance d'une loi
 *      géométrique rend la malchance invisible ici. Une graine malheureuse coûte
 *      plus cher, c'est `tests/walkthrough/play.spec.ts` qui mesure ce tirage-là.
 *   4. La prospection vaut la valeur de fiche (100) : `computeDropChance` rend
 *      donc exactement `baseDropRate`. Un héros mieux équipé farme moins.
 *   5. Un ingrédient sans lâcheur dans une zone de spawn a une chance nulle, donc
 *      une espérance infinie : le test échoue, ce qui est le but (une ressource
 *      non farmable n'a pas sa place dans une recette de clef).
 */

const DATA_DIR = join(process.cwd(), "data");
const MIN_ENCOUNTERS = 5;
const MAX_ENCOUNTERS = 10;
/** Prospection de référence : celle des taux de la fiche (§2). */
const FICHE_PP = 100;

const read = (file: string): string => readFileSync(join(DATA_DIR, file), "utf8");
const items = parseItemsYaml(read("items.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const recipes = parseRecipesYaml(read("recipes.yaml"));
const zones = parseSpawnsYaml(read("spawns.yaml"));

/** Le catalogue décide : toute recette qui produit un item `key` est mesurée. */
const isKeyRecipe = (recipe: RecipeDef): boolean =>
  items.some((item) => item.id === recipe.resultItemId && item.category === "key");

const keyRecipes = recipes.filter(isKeyRecipe);

const zoneTotalWeight = (zone: SpawnZoneDef): number =>
  zone.monsters.reduce((total, entry) => total + entry.weight, 0);

/** Part d'une rencontre consacrée à ce monstre : poids relatif / somme de la zone. */
const spawnShare = (zone: SpawnZoneDef, monsterId: string): number => {
  const entry = zone.monsters.find((candidate) => candidate.monsterId === monsterId);
  return entry === undefined ? 0 : entry.weight / zoneTotalWeight(zone);
};

/** Chance de drop d'un item sur UN combat de ce monstre, calculée par le moteur. */
const dropChanceOf = (monsterId: string, itemId: string): number => {
  const monster = monsters.find((candidate) => candidate.id === monsterId);
  const line = monster?.loot.find((entry) => entry.itemId === itemId);
  if (line === undefined) return 0;
  const options = { playerPp: FICHE_PP, ppThreshold: line.ppThreshold, baseDropRate: line.baseDropRate };
  return computeDropChance(options);
};

/** Chance de drop par rencontre dans une zone : somme des lâcheurs réellement tirés. */
const chancePerFight = (zone: SpawnZoneDef, itemId: string): number =>
  zone.monsters.reduce(
    (chance, entry) => chance + spawnShare(zone, entry.monsterId) * dropChanceOf(entry.monsterId, itemId),
    0,
  );

/** Meilleure zone pour cet ingrédient : le joueur choisit sa plage. */
const bestChancePerFight = (itemId: string): number =>
  zones.reduce((best, zone) => Math.max(best, chancePerFight(zone, itemId)), 0);

interface FarmRow {
  itemId: string;
  quantity: number;
  /** Chance de drop par rencontre, dans la meilleure zone. */
  chance: number;
  /** Espérance du nombre de rencontres pour obtenir la quantité requise. */
  encounters: number;
}

const farmRow = (ingredient: RecipeIngredient): FarmRow => {
  const chance = bestChancePerFight(ingredient.itemId);
  const { itemId, quantity } = ingredient;
  return { itemId, quantity, chance, encounters: quantity / chance };
};

const farmRows = (recipe: RecipeDef): readonly FarmRow[] => recipe.ingredients.map(farmRow);

const costliest = (rows: readonly FarmRow[]): FarmRow =>
  rows.reduce((worst, row) => (row.encounters > worst.encounters ? row : worst));

const formatRow = (row: FarmRow): string =>
  `${row.itemId} x${row.quantity} : ${(row.chance * 100).toFixed(2)} %/rencontre → ${row.encounters.toFixed(2)} rencontres`;

const tableOf = (recipe: RecipeDef): string =>
  [`${recipe.id} (${recipe.resultItemId})`, ...farmRows(recipe).map(formatRow)].join("\n  ");

describe("budget de farm des clefs (D07) — le catalogue est bien lu", () => {
  it("mesure au moins une recette de clef", () => {
    expect(keyRecipes.map((recipe) => recipe.resultItemId)).not.toEqual([]);
  });
});

for (const recipe of keyRecipes) {
  describe(`budget de farm : ${recipe.id}`, () => {
    it("colle le tableau des espérances par ingrédient", () => {
      // Ce `log` EST le tableau collé dans la PR : une ligne par ingrédient.
      console.log(`\n  ${tableOf(recipe)}`);
      farmRows(recipe).forEach((row) => expect(row.chance).toBeGreaterThan(0));
    });

    it("n'exige pas plus de 10 rencontres pour son ingrédient le plus cher", () => {
      const worst = costliest(farmRows(recipe));
      const message = `la clef demande trop de farm : ${formatRow(worst)} (plafond ${MAX_ENCOUNTERS})`;
      expect(worst.encounters, message).toBeLessThanOrEqual(MAX_ENCOUNTERS);
    });

    it("n'est pas donnée : l'ingrédient le plus cher coûte au moins 5 rencontres", () => {
      const worst = costliest(farmRows(recipe));
      const message = `la clef est donnée : ${formatRow(worst)} (plancher ${MIN_ENCOUNTERS})`;
      expect(worst.encounters, message).toBeGreaterThanOrEqual(MIN_ENCOUNTERS);
    });
  });
}
