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
 *   drops → `craftMany` sur la recette réelle → `enterDungeon` qui consomme
 *   exactement une clé, avec les ingrédients fournis par le farm seul.
 * Les drops passent par `resolveCombatRewards` — la fonction exacte que le store
 * appelle en combat (`useCombatStore.ts`) — avec vraie prospection et vrai
 * `computeDropChance`. Aucun `Math.random`. Les `drops` rendus par le moteur sont
 * appliqués TELS QUELS via `addItem`, **filtrés sur les ingrédients de la
 * recette** : depuis `DEC-07` la clef est aussi butin direct et tomberait ici
 * sans que ce chemin-là soit celui que ce fichier mesure. Aucune quantité
 * d'ingrédient n'est inventée.
 *
 * LE TRAJET EXPLORATION, EN DEUX TEMPS DISTINCTS :
 *   - `pickSpawn` (sur `data/spawns.yaml`) prouve que CHAQUE monstre de la zone
 *     est réellement tirable, un par un, `rng` dérivé de sa bande de poids ;
 *   - la boucle de farm, elle, NE PASSE PAS par `pickSpawn` : `farmZone` parcourt
 *     `zone.monsters` dans l'ordre du YAML et NE MODÉLISE DONC PAS la rareté du
 *     spawn. Les rencontres affichées sont un coût de drop, pas un coût de jeu.
 *
 * CE QUE COÛTE CE FARM — TROIS CHIFFRES, TROIS STATUTS :
 *   1. 4 rencontres : PLANCHER DÉTERMINISTE, pas une mesure. Sous `DROP_RNG`,
 *      chaque combat lâche (`dropChance > rng`), donc il faut exactement
 *      1 pince + 1 boulon + 2 gouttes = 4 combats. C'est le minimum absolu de la
 *      recette livrée (1/1/2, cf. `DEC-07`).
 *   2. ≈ 7,7 combats : ESPÉRANCE de la CHAÎNE DE CRAFT, `2/0,45 + 1/0,60 +
 *      1/0,65` (≈ 4,4 Piou + 1,7 crabe + 1,5 boulon), si le joueur ne combat que
 *      ce dont il a besoin ET qu'il craft au lieu de compter sur le butin.
 *   3. ≈ 170 tirages de spawn : coût NON MODÉLISÉ, et propre au CRAFT. Les
 *      tirages sont PARTAGÉS — chaque tirage donne UN monstre — donc ils ne
 *      s'additionnent pas par ingrédient. Le boulon (4/146, ≈ 2,7 %) domine :
 *      ≈ 169 tirages pour son unique unité, qui couvrent en chemin ≈ 14 crabes
 *      (1 suffit) et ≈ 116 pious (4,4 suffisent).
 *      Un vrai joueur paie ces tirages, ce walkthrough ne les paie pas.
 *
 * LA CLEF ELLE-MÊME — `DEC-07` : depuis la décision sur les clefs, la clef est
 * aussi BUTIN DIRECT du `fer_crabe_cle_molette` (0,60) et du `fer_rat_de_cale`
 * (0,45), soit 14,18 % par rencontre ⇒ ≈ 7,05 rencontres en moyenne. Ce fichier
 * mesure donc le chemin GARANTI (craft), pas le chemin le moins cher ; le coût
 * TOTAL des deux chemins est borné par `tests/data/keyFarmBudget.spec.ts`.
 *
 * CE QU'IL NE PROUVE PAS : qu'un JOUEUR peut déclencher cette chaîne depuis
 * l'écran. Aucun écran, aucun store, aucun événement d'UI n'est exercé ici : le
 * câblage exploration → combat → craft → porte est du ressort de la 5D. Il ne
 * prouve pas non plus la faisabilité côté joueur : ni le coût de spawn chiffré
 * ci-dessus, ni le niveau de zone (un héros de niveau 1 croise un niveau 15,
 * cf. DETTE de `data/spawns.yaml`).
 *
 * COHÉRENCE DES QUANTITÉS : `data/recipes.yaml` n'est PLUS fidèle au §7
 * « Recettes de craft (22) » de `docs/design/islands/ile_de_la_ferraille.md`,
 * qui dit encore `fer_pince_de_douze×3, fer_boulon_sans_fin×3,
 * fer_goutte_mazout×2`. La recette livrée est 1/1/2, et le §7 de la fiche porte
 * désormais l'ERRATUM correspondant, motivé par `DEC-07` (5 à 10 rencontres par
 * clef). Aucune quantité n'est recopiée ici en dur : toutes viennent des
 * `quantity` du YAML, la contradiction entre documents est donc levée côté
 * données — seuls les chiffres de ce commentaire ont dû suivre.
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
/**
 * GARDE-FOU DE BOUCLE, et PAS une mesure de farm : sous `DROP_RNG` chaque combat
 * lâche, il faut donc 1 combat par unité, et ces bornes (120 / 500) sont
 * INATTEIGNABLES avec les données actuelles (8 combats au total). Elles existent
 * seulement pour qu'une régression de `computeDropChance` (chance ramenée à 0,
 * seuil de PP infranchissable) échoue en quelques millisecondes au lieu de
 * boucler.
 */
const LOOP_GUARD_PER_MONSTER = 120;
const LOOP_GUARD_TOTAL = 500;
/** Balayage de la contre-épreuve : combien de fois on insiste par monstre. */
const BARREN_SWEEP = 20;
/**
 * PLANCHER DÉTERMINISTE, pas une mesure d'équilibrage : sous toutes les chances
 * calculées (0,45 / 0,60 / 0,65) chaque combat lâche, d'où exactement 1 combat
 * par unité. Les 4 rencontres du test sont le minimum absolu de la recette
 * 1/1/2 ; l'espérance de la chaîne de craft est ≈ 7,7 combats, et le coût de
 * spawn (≈ 170 tirages PARTAGÉS, dominés par le boulon à 4/146) n'est pas
 * modélisé du tout (cf. en-tête).
 */
const DROP_RNG = 0.1;
/** Au-dessus de toutes les chances de drop ⇒ aucun butin ne tombe jamais. */
const NO_DROP_RNG = 0.99;
const LOOP_GUARD_HIT = "garde-fou de boucle atteint : aucun butin ne sort (chance de drop nulle ?)";

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

/** Ce fichier mesure la CHAÎNE DE CRAFT : les ingrédients, pas la clef elle-même. */
function isKeyIngredient(itemId: string): boolean {
  return neededQuantity(itemId) > 0;
}

function fightMonster(state: FarmState, monsterId: string, rng: Rng): FarmState {
  const drops = fightOnce(monsterId, rng).filter(isKeyIngredient);
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

/** Insiste tant qu'il manque l'ingrédient ; garde-fou de boucle (jamais atteint). */
function huntLoot(state: FarmState, monsterId: string, itemId: string, rng: Rng): FarmState {
  let current = state;
  while (missingQuantity(current, itemId) > 0) {
    const fought = encountersOf(current, monsterId);
    if (fought >= LOOP_GUARD_PER_MONSTER) {
      throw new Error(`${LOOP_GUARD_HIT} : ${itemId} via ${monsterId} en ${fought} rencontres`);
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

/**
 * Farm complet : chaque monstre de la zone, DANS L'ORDRE DU YAML, pour son butin
 * utile. Ne passe pas par `pickSpawn` : la rareté du spawn n'est pas modélisée.
 */
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

/**
 * La chance doit être un VRAI tirage, pas un 0 de seuil de PP : elle doit
 * dépasser le plancher `DROP_RNG`, sinon les 4 rencontres ne tomberaient pas.
 */
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

/**
 * Plancher déterministe : sous `DROP_RNG` chaque combat lâche son ingrédient, il
 * faut donc exactement 1 combat par unité de la recette. C'est le MINIMUM, pas
 * une mesure : l'espérance de la chaîne de craft est ≈ 7,7 combats et la rareté
 * du spawn n'est pas payée ici (cf. en-tête). Le garde-fou total reste une
 * simple ceinture.
 */
function assertDeterministicFloor(farm: FarmState): void {
  const total = Object.values(farm.encounters).reduce((sum, count) => sum + count, 0);
  const needed = keyRecipe().ingredients.reduce((sum, entry) => sum + entry.quantity, 0);
  expect(total).toBe(needed);
  expect(total).toBeLessThanOrEqual(LOOP_GUARD_TOTAL);
  // Le Rat d'Égoût-dron à 0 rencontre n'est PAS une vérité structurelle : le
  // Piou est en tête du YAML et couvre la goutte avant lui. Avec un autre `rng`
  // (ou un autre ordre), le rat lâche la même goutte ; il reste tirable en jeu.
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
  assertDeterministicFloor(farm);
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
      // C'est CETTE inégalité qui garantit « aucun butin » : une chance de 1,0
      // ferait tomber le drop malgré un `rng` à 0,99, et le test doit le voir.
      expect(dropChance(itemId)).toBeLessThanOrEqual(NO_DROP_RNG);
    }
    const crafted = craftKey(barren.inventory);
    expect(crafted.craftedCount).toBe(0);
    expect(crafted.inventory).toBe(barren.inventory);
  });
});
