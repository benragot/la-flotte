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
 * COÛT DES CLEFS DE DONJON — décision `DEC-07` : une clef se ramasse en
 * **5 à 10 rencontres**, en moyenne. Ce fichier est le garde-fou de la décision
 * et il parcourt TOUTES les recettes dont le résultat a `category: key` : aucun
 * id de clef n'est écrit ici, une nouvelle clef est mesurée automatiquement.
 *
 * CE QUI EST BORNÉ — LE COÛT TOTAL, PAS LE MAX PAR INGRÉDIENT.
 * La première version de ce test assertait `max_i(E_i)`. C'était une BORNE
 * INFÉRIEURE : une clef exigeant tous ses ingrédients sur un même flux de
 * rencontres coûte `E[max_i]`, pas `max_i`. Sur deux chasses à 9,61 et 9,42,
 * `E[max] ≈ 9,61 + 9,42 − 5,02 ≈ 14,0` (formule `E[max] = E_a + E_b − E[min]`,
 * `E[min] = 1/(1 − (1 − p_a)(1 − p_b))`). Le max reste calculé, mais seulement
 * comme DIAGNOSTIC : il localise le goulot dans le message d'échec.
 *
 * COÛT RETENU = LE MOINS CHER DES DEUX CHEMINS, comme un joueur.
 *   - `craft` : borne HAUTE `Σ quantité_i / chance_i`. On majore `E[max]` en
 *     ignorant les termes négatifs de l'inclusion–exclusion (`− E[min]`,
 *     `+ E[min de 3]`…). C'est conservateur : le test ne peut pas laisser
 *     passer un craft plus long que la réalité.
 *   - `drop` : si la clef est BUTIN DIRECT d'un monstre de la zone, `1 / p` est
 *     EXACT (loi géométrique, une rencontre = un tirage indépendant).
 *   - `total = min(craft, drop)` : le joueur farme un seul flux de rencontres,
 *     il obtient la clef au premier des deux chemins complété. Une clef qui n'a
 *     qu'une recette est jugée sur sa recette ; une clef droppable ET craftable
 *     est jugée sur le chemin le moins cher.
 *
 * AUTRES APPROXIMATIONS ASSUMÉES :
 *   1. La meilleure zone par ingrédient (`spawns.yaml` en déclare une par map) :
 *      le joueur choisit sa plage, il n'insiste pas sur la mauvaise.
 *   2. Espérance et non distribution : la variance d'une géométrique reste
 *      mesurée par `tests/walkthrough/play.spec.ts`, ce test ne la modélise pas.
 *   3. Prospection = valeur de fiche (100) : `computeDropChance` rend donc
 *      exactement `baseDropRate`. Un héros mieux équipé farme moins.
 *   4. Un ingrédient sans lâcheur dans une zone de spawn a une chance nulle, donc
 *      un coût de craft infini : la clef doit alors être droppable, sinon le
 *      test échoue — ce qui est le but.
 *   5. LIMITE CONNUE, non bloquante : un ingrédient dont `ppThreshold` dépasse
 *      100 serait mesuré à chance nulle (donc « infini ») alors qu'un héros de
 *      fiche ne pourrait simplement pas le dropper. Fail-safe assumé : le test
 *      signalera la clef comme infarmable plutôt que de la laisser passer.
 */

const DATA_DIR = join(process.cwd(), "data");
/** `DEC-07` : bornes du coût d'obtention d'une clef, en rencontres. */
const KEY_FIGHTS_MIN = 5;
const KEY_FIGHTS_MAX = 10;
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

/** Meilleure zone pour cet item : le joueur choisit sa plage. */
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

/** Diagnostic seulement : le goulot du chemin de craft, jamais la borne. */
const costliest = (rows: readonly FarmRow[]): FarmRow =>
  rows.reduce((worst, row) => (row.encounters > worst.encounters ? row : worst));

/** Borne haute du craft : Σ E_i majore `E[max]` (intersections retranchées ignorées). */
const craftCost = (rows: readonly FarmRow[]): number =>
  rows.reduce((total, row) => total + row.encounters, 0);

/** Chemin direct : loi géométrique de paramètre `p`, donc `E = 1/p` exactement. */
const dropCost = (itemId: string): number => 1 / bestChancePerFight(itemId);

type Path = "craft" | "drop";

interface CheapestPath {
  cost: number;
  path: Path;
}

/** Le joueur prend le chemin le moins cher : craft (Σ) ou butin direct (1/p). */
const cheapestPath = (recipe: RecipeDef, rows: readonly FarmRow[]): CheapestPath => {
  const craft = craftCost(rows);
  const drop = dropCost(recipe.resultItemId);
  return drop < craft ? { cost: drop, path: "drop" } : { cost: craft, path: "craft" };
};

const formatCost = (cost: number): string => (Number.isFinite(cost) ? cost.toFixed(2) : "infini");

const formatRow = (row: FarmRow): string =>
  `${row.itemId} x${row.quantity} : ${(row.chance * 100).toFixed(2)} %/rencontre → ${formatCost(row.encounters)}`;

const summaryOf = (recipe: RecipeDef, rows: readonly FarmRow[]): string => {
  const best = cheapestPath(recipe, rows);
  const craft = craftCost(rows);
  const drop = dropCost(recipe.resultItemId);
  return `craft (Σ) ${formatCost(craft)} | drop direct ${formatCost(drop)} | retenu ${best.path} ${formatCost(best.cost)}`;
};

const tableOf = (recipe: RecipeDef): string => {
  const rows = farmRows(recipe);
  const lines = [recipe.id, ...rows.map(formatRow), summaryOf(recipe, rows)];
  return lines.join("\n  ");
};

describe("coût des clefs (DEC-07) — le catalogue est bien lu", () => {
  it("mesure au moins une recette de clef", () => {
    expect(keyRecipes.map((recipe) => recipe.resultItemId)).not.toEqual([]);
  });
});

for (const recipe of keyRecipes) {
  describe(`coût de la clef : ${recipe.id}`, () => {
    it("colle le tableau des espérances et du coût total", () => {
      // Ce `log` EST le tableau collé dans la PR : une ligne par ingrédient.
      console.log(`\n  ${tableOf(recipe)}`);
      expect(cheapestPath(recipe, farmRows(recipe)).cost).not.toBeNaN();
    });

    it("ne coûte pas plus de 10 rencontres, chemin le moins cher compris", () => {
      const rows = farmRows(recipe);
      const best = cheapestPath(recipe, rows);
      const message = `la clef demande trop de farm : ${formatCost(best.cost)} rencontres par « ${best.path} » (goulot du craft : ${formatRow(costliest(rows))} ; plafond ${KEY_FIGHTS_MAX})`;
      expect(best.cost, message).toBeLessThanOrEqual(KEY_FIGHTS_MAX);
    });

    it("n'est pas donnée : au moins 5 rencontres par le meilleur chemin", () => {
      const best = cheapestPath(recipe, farmRows(recipe));
      const message = `la clef est donnée : ${formatCost(best.cost)} rencontres par « ${best.path} » (plancher ${KEY_FIGHTS_MIN})`;
      expect(best.cost, message).toBeGreaterThanOrEqual(KEY_FIGHTS_MIN);
    });
  });
}
