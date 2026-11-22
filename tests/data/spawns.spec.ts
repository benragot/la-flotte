import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseRecipesYaml } from "../../src/schemas/recipeSchema";
import { parseSpawnsYaml } from "../../src/schemas/spawnSchema";

const DATA_DIR = join(process.cwd(), "data");
const KEY_ID = "cle_donjon_ile_de_la_ferraille";

const read = (file: string): string => readFileSync(join(DATA_DIR, file), "utf8");
const loadSpawns = () => parseSpawnsYaml(read("spawns.yaml"));
const loadMonsters = () => parseMonstersYaml(read("monsters.yaml"));
const loadMaps = () => parseMapsYaml(read("maps.yaml"));

/** Ingrédients lus dans `recipes.yaml`, jamais recopiés en dur. */
const keyIngredientIds = (): string[] => {
  const recipe = parseRecipesYaml(read("recipes.yaml")).find((entry) => entry.resultItemId === KEY_ID);
  if (recipe === undefined) throw new Error(`aucune recette ne produit ${KEY_ID}`);
  return recipe.ingredients.map((entry) => entry.itemId);
};

/** Lâcheurs de `itemId` **présents dans la table de spawn** : farmables sans clef. */
const farmableDroppers = (itemId: string): string[] => {
  const spawned = new Set(loadSpawns().flatMap((zone) => zone.monsters.map((entry) => entry.monsterId)));
  return loadMonsters()
    .filter((monster) => monster.loot.some((entry) => entry.itemId === itemId))
    .filter((monster) => spawned.has(monster.id))
    .map((monster) => monster.id);
};

describe("data/spawns.yaml — intégrité référentielle", () => {
  it("référence uniquement des monstres et des maps existants", () => {
    const monsterIds = new Set(loadMonsters().map((monster) => monster.id));
    const mapIds = new Set(loadMaps().map((map) => map.id));
    loadSpawns().forEach((zone) => {
      expect(mapIds.has(zone.mapId), `${zone.mapId} est absent de maps.yaml`).toBe(true);
      zone.monsters.forEach((entry) => {
        expect(monsterIds.has(entry.monsterId), `${entry.monsterId} est absent de monsters.yaml`).toBe(true);
      });
    });
  });

  it("déclare au moins deux zones aux ids uniques", () => {
    const ids = loadSpawns().map((zone) => zone.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("déclare une zone pour la map d'exploration", () => {
    const explorationMaps = loadSpawns().filter((zone) => zone.mapId === "ferraille_plage_01");
    expect(explorationMaps.length).toBeGreaterThanOrEqual(1);
  });
});

// Pendant **inverse** de `tests/data/keyCrafting.spec.ts`, qui constate aujourd'hui
// que « tous les lâcheurs des ingrédients de la clef sont des monstres de donjon »
// (donc inatteignables, la clef étant la condition d'entrée du donjon). Cette
// table de spawn d'exploration doit rendre ce constat faux : quand elle sera
// livrée, le test de `keyCrafting.spec.ts` devra être retourné en « aucun lâcheur
// n'est exclusivement en donjon », et celui-ci reste la preuve côté joueur :
// chaque ingrédient est lâché par un monstre qu'on rencontre **sans la clef**.
describe("data/spawns.yaml — la clef du donjon devient farmable", () => {
  it.each(keyIngredientIds())("fait tomber %s depuis l'exploration", (itemId) => {
    expect(farmableDroppers(itemId), `${itemId} n'est lâché par aucun monstre de spawns.yaml`).not.toEqual([]);
  });
});
