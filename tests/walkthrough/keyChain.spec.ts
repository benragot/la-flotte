import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initCombat } from "../../src/engine/combatLoop/init";
import { resolveCombatRewards } from "../../src/engine/combatLoop/rewards";
import { craftMany } from "../../src/engine/craft";
import type { CraftManyResult } from "../../src/engine/craft";
import { createHero } from "../../src/engine/createHero";
import { enterDungeon } from "../../src/engine/dungeon";
import { computeDropChance, computeProspection } from "../../src/engine/economy";
import { cumulativeWeights, pickSpawn, zoneForMap } from "../../src/engine/exploration";
import type { Rng, SpawnZone } from "../../src/engine/exploration";
import { parseAsciiMap } from "../../src/engine/grid";
import { addItem, countItem, removeItem } from "../../src/engine/inventory";
import type { InventoryState } from "../../src/engine/inventory";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import type { ItemDef } from "../../src/schemas/itemSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import type { LootEntry } from "../../src/schemas/monsterSchema";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";
import { parseRecipesYaml } from "../../src/schemas/recipeSchema";
import type { RecipeDef } from "../../src/schemas/recipeSchema";
import { parseSpawnsYaml } from "../../src/schemas/spawnSchema";

/**
 * WALKTHROUGH — la chaîne de la clé : farm → craft → entrée du donjon.
 *
 * CE QUE CE FICHIER PROUVE : la chaîne de DONNÉES et de MOTEUR, avec les YAML
 * réels et aucun inventaire fabriqué.
 *   exploration (`data/spawns.yaml`) `pickSpawn` → monstres lâcheurs
 *   → drops tirés par `resolveCombatRewards` (vraie prospection, vrai
 *     `computeDropChance`) → `craftMany` sur la recette réelle
 *   → `enterDungeon` qui consomme exactement une clé.
 * Chaque rencontre est un appel à la fonction de production : le nombre de
 * rencontres n'est pas un décor, c'est le résultat du tirage.
 *
 * CE QU'IL NE PROUVE PAS : qu'un JOUEUR peut déclencher cette chaîne depuis
 * l'écran. Aucun écran, aucun store, aucun événement d'UI n'est exercé ici : le
 * câblage exploration → combat → craft → porte est du ressort de la 5D. Ce
 * fichier ne prouve pas non plus l'équilibrage de la plage, ni le niveau de
 * zone (cf. DETTE de `data/spawns.yaml`) : un héros de niveau 1 peut y croiser
 * un niveau 15, ce walkthrough le montre sans le corriger.
 *
 * COHÉRENCE DES QUANTITÉS : la seule source est `data/recipes.yaml` (3 pinces,
 * 3 boulons, 2 gouttes). Le commentaire de la recette renvoie au « §7 » de
 * `docs/design/islands/ile_de_la_ferraille.md`, section qui n'existe PAS : la
 * fiche ne contient ni §7 ni recette de clé. Aucune quantité n'est donc
 * recopiée ici en dur, sinon celle du YAML.
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));
const items = parseItemsYaml(read("items.yaml"));
const maps = parseMapsYaml(read("maps.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const progression = parseProgressionYaml(read("progression.yaml"));
const recipes = parseRecipesYaml(read("recipes.yaml"));
const spawns = parseSpawnsYaml(read("spawns.yaml"));

const ZONE_MAP_ID = "ferraille_plage_01";
const DUNGEON_ID = "fer_donjon_casse_vis_sans_fin";
const RECIPE_ID = "recette_cle_donjon_ile_de_la_ferraille";
/** Une rencontre coûte au plus ce nombre de combats : au-delà, la chaîne est infarmable. */
const MAX_ENCOUNTERS_PER_MONSTER = 120;
/** Budget total de farm : au-delà, la chaîne demanderait trop de farm pour être jouable. */
const MAX_TOTAL_ENCOUNTERS = 500;
/** Balayage de la contre-épreuve : combien de fois on insiste par monstre. */
const BARREN_SWEEP = 20;
/** Sous toutes les chances de drop calculées ⇒ le butin tombe à chaque rencontre. */
const DROP_RNG = 0.1;
/** Au-dessus de toutes les chances de drop ⇒ aucun butin ne tombe jamais. */
const NO_DROP_RNG = 0.99;
const TOO_MUCH_FARM = "la chaîne demande trop de farm pour être jouable";

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

function startingHero() {
  return createHero("Anselme", mustFind(classes, "iop"));
}

const emptyInventory = (): InventoryState => ({ stacks: [], equipment: {} });

const PROSPECTION = computeProspection({
  basePp: startingHero().pp,
  chance: startingHero().chance,
});

function keyRecipe(): RecipeDef {
  return mustFind(recipes, RECIPE_ID);
}

/** La zone d'exploration vient du YAML : un `mapId` inventé tomberait en repli. */
function explorationZone(): SpawnZone {
  const selection = zoneForMap(spawns, ZONE_MAP_ID);
  if (selection.fallback) throw new Error(`aucune zone déclarée pour ${ZONE_MAP_ID}`);
  return selection.zone;
}

function lootLine(monsterId: string, itemId: string): LootEntry {
  const found = mustFind(monsters, monsterId).loot.find((entry) => entry.itemId === itemId);
  if (found === undefined) throw new Error(`${itemId} absent du butin de ${monsterId}`);
  return found;
}

/** Un combat réel : c'est `resolveCombatRewards` qui tire le butin, pas le test. */
function rewardsFor(monsterId: string, rng: Rng) {
  const map = parseAsciiMap(["P.M."]);
  const hero = startingHero();
  const monster = mustFind(monsters, monsterId);
  const combat = initCombat({ map, hero, monster, spells: [] });
  return resolveCombatRewards({ heroXp: 0, hero: combat.player, monster, progression, rng });
}

function fightOnce(monsterId: string, rng: Rng): string[] {
  return rewardsFor(monsterId, rng).drops;
}

interface FarmState {
  inventory: InventoryState;
  encounters: Record<string, number>;
}

function encountersOf(state: FarmState, monsterId: string): number {
  return state.encounters[monsterId] ?? 0;
}

function withDrops(inventory: InventoryState, drops: readonly string[]): InventoryState {
  return drops.reduce(
    (current, itemId) => addItem({ inventory: current, itemId, quantity: 1 }),
    inventory,
  );
}

function fightMonster(state: FarmState, monsterId: string, rng: Rng): FarmState {
  const drops = fightOnce(monsterId, rng);
  const encounters = { ...state.encounters, [monsterId]: encountersOf(state, monsterId) + 1 };
  return { inventory: withDrops(state.inventory, drops), encounters };
}

function neededQuantity(itemId: string): number {
  const ingredient = keyRecipe().ingredients.find((entry) => entry.itemId === itemId);
  return ingredient?.quantity ?? 0;
}

function missingQuantity(state: FarmState, itemId: string): number {
  return neededQuantity(itemId) - countItem(state.inventory, itemId);
}

/** Insiste tant qu'il manque l'ingrédient, et échoue si le farm est infarmable. */
function huntLoot(state: FarmState, monsterId: string, itemId: string, rng: Rng): FarmState {
  let current = state;
  while (missingQuantity(current, itemId) > 0) {
    const fought = encountersOf(current, monsterId);
    if (fought >= MAX_ENCOUNTERS_PER_MONSTER) {
      throw new Error(`${TOO_MUCH_FARM} : ${itemId} via ${monsterId} en ${fought} rencontres`);
    }
    current = fightMonster(current, monsterId, rng);
  }
  return current;
}

function keyLootOf(monsterId: string): string[] {
  return mustFind(monsters, monsterId)
    .loot.map((entry) => entry.itemId)
    .filter((itemId) => neededQuantity(itemId) > 0);
}

function huntMonster(state: FarmState, monsterId: string, rng: Rng): FarmState {
  return keyLootOf(monsterId).reduce(
    (current, itemId) => huntLoot(current, monsterId, itemId, rng),
    state,
  );
}

/** Farm complet : chaque monstre de la zone, dans l'ordre du YAML, pour son butin utile. */
function farmZone(rng: Rng): FarmState {
  const start: FarmState = { inventory: emptyInventory(), encounters: {} };
  return explorationZone().monsters.reduce(
    (state, entry) => huntMonster(state, entry.monsterId, rng),
    start,
  );
}

function timesOver(state: FarmState, monsterId: string, times: number, rng: Rng): FarmState {
  let current = state;
  for (let index = 0; index < times; index += 1) current = fightMonster(current, monsterId, rng);
  return current;
}

/** Balayage borné : insiste sans exiger le butin (contre-épreuve du farm). */
function sweepZone(times: number, rng: Rng): FarmState {
  const start: FarmState = { inventory: emptyInventory(), encounters: {} };
  return explorationZone().monsters.reduce(
    (state, entry) => timesOver(state, entry.monsterId, times, rng),
    start,
  );
}

/** `rng` au milieu de la bande de poids du monstre : dérivé du YAML, pas deviné. */
function spawnRngFor(monsterId: string): number {
  const zone = explorationZone();
  const bounds = cumulativeWeights(zone.monsters);
  const index = zone.monsters.findIndex((entry) => entry.monsterId === monsterId);
  if (index < 0) throw new Error(`${monsterId} absent de la zone ${zone.id}`);
  const floor = bounds[index - 1] ?? 0;
  const ceil = bounds[index] ?? 0;
  const total = bounds[bounds.length - 1] ?? 1;
  return (floor + (ceil - floor) / 2) / total;
}

/** Aucun monstre n'est écrit à la main : chacun est retiré par `pickSpawn`. */
function spawnedMonsterIds(): string[] {
  const zone = explorationZone();
  return zone.monsters.map((entry) => {
    const pick = pickSpawn({ zones: spawns, mapId: zone.mapId, rng: () => spawnRngFor(entry.monsterId) });
    expect(pick.zoneId).toBe(zone.id);
    expect(pick.fallback).toBe(false);
    expect(pick.monsterId).toBe(entry.monsterId);
    return pick.monsterId;
  });
}

function keyDroppers(itemId: string): string[] {
  return spawnedMonsterIds().filter((monsterId) =>
    mustFind(monsters, monsterId).loot.some((entry) => entry.itemId === itemId),
  );
}

/** Le monstre retiré par `pickSpawn` lâche vraiment l'ingrédient. */
function dropperFor(itemId: string): string {
  const monsterId = keyDroppers(itemId)[0];
  if (monsterId === undefined) throw new Error(`${itemId} n'a aucun lâcheur dans la zone`);
  return monsterId;
}

/** Chance réelle, calculée par le moteur sur les données du YAML. */
function dropChance(itemId: string): number {
  const line = lootLine(dropperFor(itemId), itemId);
  const input = { playerPp: PROSPECTION, ppThreshold: line.ppThreshold, baseDropRate: line.baseDropRate };
  return computeDropChance(input);
}

/** Sous le seuil de PP, la chance serait nulle : on exige ici un vrai tirage. */
function assertDroppable(itemId: string): void {
  expect(dropChance(itemId)).toBeGreaterThan(DROP_RNG);
}

/** La clé attendue par le donjon est celle de la recette, et c'est une vraie clé. */
function assertKeyContract(): void {
  const dungeon: DungeonDef = mustFind(dungeons, DUNGEON_ID);
  const key: ItemDef = mustFind(items, dungeon.keyItemId);
  expect(keyRecipe().resultItemId).toBe(dungeon.keyItemId);
  expect(key.category).toBe("key");
  for (const { itemId } of keyRecipe().ingredients) {
    expect(mustFind(items, itemId).category).toBe("resource");
  }
}

/** Budget de rencontres : borné, et exactement la somme des quantités de la recette. */
function assertEncounterBudget(farm: FarmState): void {
  const total = Object.values(farm.encounters).reduce((sum, count) => sum + count, 0);
  const needed = keyRecipe().ingredients.reduce((sum, entry) => sum + entry.quantity, 0);
  expect(total).toBe(needed);
  expect(total).toBeLessThanOrEqual(MAX_TOTAL_ENCOUNTERS);
  // Sous `DROP_RNG`, chaque rencontre lâche son ingrédient : autant de combats
  // que la quantité de la recette, ni plus ni moins. (Le Rat d'Égoût-dron, qui
  // partage la goutte avec le Piou, n'est jamais atteint : 0 rencontre.)
  for (const { itemId, quantity } of keyRecipe().ingredients) {
    expect(encountersOf(farm, dropperFor(itemId))).toBe(quantity);
  }
}

function craftKey(inventory: InventoryState): CraftManyResult {
  return craftMany({ recipe: keyRecipe(), inventory, times: 1 });
}

/** Le farm complet, ingrédients vérifiés un par un sur les quantités de la recette. */
function farmKey(rng: Rng): FarmState {
  const farm = farmZone(rng);
  assertEncounterBudget(farm);
  for (const { itemId, quantity } of keyRecipe().ingredients) {
    assertDroppable(itemId);
    expect(countItem(farm.inventory, itemId)).toBe(quantity);
  }
  return farm;
}

/** L'entrée consomme exactement une clé, et vide les ingrédients déjà partis au craft. */
function assertDungeonEntry(crafted: CraftManyResult): void {
  const dungeon: DungeonDef = mustFind(dungeons, DUNGEON_ID);
  const result = enterDungeon({ dungeon, inventory: crafted.inventory });
  expect(result.reason).toBeNull();
  expect(result.run?.roomIndex).toBe(0);
  expect(result.run?.keysConsumed).toBe(1);
  expect(countItem(crafted.inventory, dungeon.keyItemId)).toBe(1);
  expect(countItem(result.inventory, dungeon.keyItemId)).toBe(0);
  for (const { itemId } of keyRecipe().ingredients) {
    expect(countItem(result.inventory, itemId)).toBe(0);
  }
}

describe("walkthrough : chaîne de la clé, du farm à la porte du donjon", () => {
  it("spawn réel → drops réels → clé craftée → run ouvert, clé consommée", () => {
    expect(mustFind(maps, ZONE_MAP_ID).id).toBe(explorationZone().mapId);
    const reachable = spawnedMonsterIds();
    expect(reachable).toEqual(explorationZone().monsters.map((entry) => entry.monsterId));
    expect(rewardsFor(reachable[0] ?? "", () => DROP_RNG).prospection).toBe(PROSPECTION);
    const crafted = craftKey(farmKey(() => DROP_RNG).inventory);
    expect(crafted.craftedCount).toBe(1);
    assertKeyContract();
    assertDungeonEntry(crafted);
  });
});

describe("walkthrough : chaîne de la clé, contre-épreuves", () => {

  it("contre-épreuve : sans la clé, le donjon refuse l'entrée", () => {
    const crafted = craftKey(farmZone(() => DROP_RNG).inventory);
    expect(crafted.craftedCount).toBe(1);
    const stripped = removeItem({
      inventory: crafted.inventory,
      itemId: keyRecipe().resultItemId,
      quantity: 1,
    });
    const result = enterDungeon({ dungeon: mustFind(dungeons, DUNGEON_ID), inventory: stripped });
    expect(result.run).toBeNull();
    expect(result.reason).toBe("no-key");
    expect(result.inventory).toBe(stripped);
  });

  it("contre-épreuve : un rng sans drop ne produit aucun ingrédient", () => {
    const barren = sweepZone(BARREN_SWEEP, () => NO_DROP_RNG);
    expect(barren.inventory.stacks).toEqual([]);
    for (const { itemId } of keyRecipe().ingredients) {
      expect(countItem(barren.inventory, itemId)).toBe(0);
      expect(dropChance(itemId)).toBeGreaterThan(0);
    }
    const crafted = craftKey(barren.inventory);
    expect(crafted.craftedCount).toBe(0);
    expect(crafted.inventory).toBe(barren.inventory);
  });
});
