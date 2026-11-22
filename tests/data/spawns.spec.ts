import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
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

  it("déclare au moins une zone, sur des maps uniques", () => {
    const zones = loadSpawns();
    const mapIds = zones.map((zone) => zone.mapId);
    expect(zones.length).toBeGreaterThanOrEqual(1);
    expect(new Set(mapIds).size).toBe(mapIds.length);
  });

  it("ne cible jamais une salle de donjon", () => {
    const dungeonMaps = new Set(
      parseDungeonsYaml(read("dungeons.yaml")).flatMap((dungeon) => dungeon.rooms.map((room) => room.mapId)),
    );
    loadSpawns().forEach((zone) => {
      expect(dungeonMaps.has(zone.mapId), `${zone.mapId} est une salle de donjon`).toBe(false);
    });
  });

  it("déclare une zone pour la map d'exploration", () => {
    const explorationMaps = loadSpawns().filter((zone) => zone.mapId === "ferraille_plage_01");
    expect(explorationMaps.length).toBeGreaterThanOrEqual(1);
  });

  // `rng() === 0` prend la **première entrée** de la zone, pas la plus lourde :
  // les walkthroughs et le combat de démo mocket `Math.random` à 0, donc
  // réordonner cette zone casserait `app.spec.ts`, `progression.spec.ts` et
  // `combatLoop.spec.ts`. L'ordre est donc verrouillé ici.
  it("place piou_mazoute en tête de la zone de la plage (démo déterministe)", () => {
    const plage = loadSpawns().find((zone) => zone.mapId === "ferraille_plage_01");
    expect(plage?.monsters[0]?.monsterId).toBe("piou_mazoute");
  });
});

// Pendant du test inversé de `tests/data/keyCrafting.spec.ts` : la table de
// spawn **est livrée**, donc chaque ingrédient de la clef a désormais un lâcheur
// qu'on rencontre hors donjon. Ici on vérifie la jointure complète
// `spawns × monsters.loot` (le monstre tombe **et** on le croise sans la clef).
describe("data/spawns.yaml — la clef du donjon devient farmable", () => {
  it.each(keyIngredientIds())("fait tomber %s depuis l'exploration", (itemId) => {
    expect(farmableDroppers(itemId), `${itemId} n'est lâché par aucun monstre de spawns.yaml`).not.toEqual([]);
  });
});
