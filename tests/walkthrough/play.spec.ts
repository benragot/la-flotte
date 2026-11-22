import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { computeDamage } from "../../src/engine/combat";
import type { CombatantState } from "../../src/engine/combatLoop";
import { resolveCombatRewards } from "../../src/engine/combatLoop/rewards";
import type { Hero } from "../../src/engine/createHero";
import { createHero } from "../../src/engine/createHero";
import { pickSpawn, zoneForMap } from "../../src/engine/exploration";
import type { SpawnZone } from "../../src/engine/exploration";
import { combatantFromHero, gainXp, spendCapitalPoints } from "../../src/engine/hero";
import { totalStatsFor } from "../../src/engine/hero/totalStats";
import { addItem, countItem, equipItem } from "../../src/engine/inventory";
import type { InventoryState, TotalStats } from "../../src/engine/inventory";
import { activeCombatant, isDefeat, isVictory, livingOf } from "../../src/engine/multiCombat";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import type { StorageLike } from "../../src/engine/save";
import type { ClassDef, StatKey } from "../../src/schemas/classSchema";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { ItemDef } from "../../src/schemas/itemSchema";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";
import type { RecipeDef } from "../../src/schemas/recipeSchema";
import { parseRecipesYaml } from "../../src/schemas/recipeSchema";
import { parseSpawnsYaml } from "../../src/schemas/spawnSchema";
import type { SpellDef } from "../../src/schemas/spellSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { castRefusal, rollSpellBase, spellCastSpec } from "../../src/store/battleSelectors";
import { emptyInventory } from "../../src/store/gameSelectors";
import { GAME_CATALOG, useGameStore } from "../../src/store/useGameStore";
import { useCombatStore } from "../../src/store/useCombatStore";

/**
 * WALKTHROUGH — « je joue » : du héros créé au donjon, sans triche.
 *
 * CE QUE CE FICHIER PROUVE : le parcours d'un joueur avec ses VRAIS moyens.
 *   création (`createCharacter`) → niveau 16 réel (`gainXp`, 75 000 XP lus
 *   dans `data/progression.yaml`) → capital dépensé (75 points en Force) →
 *   équipement de départ (`starting: true` seulement) → farm réel (`pickSpawn` +
 *   `resolveCombatRewards`, vrais taux) → `ensureKey` → `enterDungeonRun` →
 *   salles jouées par les actions du store.
 *   Aucun `level: 16` écrit à la main : c'est `gainXp` qui monte le héros.
 *
 * COMMENT LA CLEF ARRIVE — DEPUIS `DEC-07`, C'EST LE BUTIN DIRECT.
 * `ensureKey` rend la main dès que la clef est au sac : sous les graines de ce
 * fichier elle tombe au 5ᵉ combat (crabe 0,60 + rat de cale 0,45, p ≈ 0,1418),
 * donc `craftRecipe` N'EST PAS exécuté ici — il ne l'est plus que dans
 * `tests/walkthrough/keyChain.spec.ts`, qui mesure la chaîne de craft complète
 * (plancher 4 combats, espérance ≈ 7,7). Le `craftRecipe` reste le repli de
 * `ensureKey` si le butin direct ne donne rien.
 *
 * Le brief annonçait « 61 000 XP pour le niveau 16 » : `data/progression.yaml`
 * place 61 000 au niveau 15 et 75 000 au niveau 16. On suit le YAML (61 000
 * aurait rendu le héros encore plus faible, donc la conclusion est inchangée).
 *
 * AUCUNE TRICHE : pas de héros à 5 000 PV (la fixture de
 * `tests/unit/dungeonEntry.spec.ts`), pas de clé injectée, pas de sort inventé
 * (`data/spells.yaml` seul, portée et LoS comprises), aucun `Math.random`
 * (LCG injecté pour le spawn et le drop, `() => 0.5` pour le combat).
 *
 * RÉSULTAT MESURÉ AUJOURD'HUI — DEC-03 est actif (`healBetweenRooms: 0.5`) et
 * c'est toujours une mauvaise nouvelle :
 *   salle 1 « La Cour aux Volatiles Gras » : GAGNÉE, 130 → 62 PV, 16 actions ;
 *   franchissement : 62 + ceil(130 × 0,5) = 127 PV rendus par la porte (DEC-03) ;
 *   salle 2 « Le Hangar à Mazout » : DÉFAITE, 127 → 0 PV, 21 actions.
 * Le héros meurt donc toujours en SALLE 2. Le soin de franchissement de DEC-03
 * retarde la mort (12 → 21 actions) sans l'éviter : il ne rend que 65 PV, une
 * seule fois, et la salle 2 en demande davantage.
 *
 * POURQUOI CE TEST EST VERT AVEC UNE DÉFAITE : sans panoplie, ce héros ne tient
 * pas la salle 2 même soigné à 127 PV. La salle 2 aligne 287 PV de monstres et
 * ce build Force n'inflige que ~26 PV par tour, alors que la porte ne rend que
 * la moitié de la barre une fois franchie. Il manque encore de la marge : le
 * soin de DEC-03 rapproche le build Force de la salle 3, il ne le fait pas
 * gagner. Une salle qui dure plus longtemps que le pool effectif ne se soigne
 * pas de l'intérieur — c'est exactement la limite mesurée ici.
 *
 * CE QUI INVERSERA L'ASSERTION : il reste l'équilibrage des salles 3-4 et de la
 * boss room (baisser les dégâts des monstres est INTERDIT par le brief DEC-03).
 * Le jour où la salle 2 tombe, remplacer `expect(second.defeat).toBe(true)` par
 * la victoire, puis dérouler les salles 3 et 4 : ce test deviendra la PREUVE
 * que le donjon est finissable par un joueur normal, pas seulement par un héros
 * de 5 000 PV.
 *
 * CE QU'IL NE PROUVE PAS : ni le déplacement du héros en salle (le store 1vN
 * n'a pas d'action de mouvement : le héros reste sur sa case de placement, les
 * monstres viennent à lui), ni l'usage de consommables en donjon (le kit de
 * départ n'en contient aucun et le héros n'a pas de kamas), ni le farm en temps
 * joueur (les rencontres sont bornées par un cap explicite, pas par une
 * horloge), ni l'équilibrage des salles 3-4 (jamais atteintes).
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
const spells = parseSpellsYaml(read("spells.yaml"));

/** Le seul donjon du catalogue : aucun id écrit ici, la donnée décide. */
const DUNGEON: DungeonDef = first(dungeons, "donjon");
/** La map de départ de la V1 est la première de `data/maps.yaml` (cf. `startMapId`). */
const START_MAP_ID = first(maps, "carte").id;
const HERO_CLASS: ClassDef = mustFind(classes, "iop");
/** Sort de dégâts du héros : premier `damage` de sa classe, comme le store. */
const HERO_SPELL: SpellDef = first(damageSpellsOfHero(), "sort de dégâts du héros");
const CAST_SPEC = spellCastSpec(HERO_SPELL, 0);
/** ITEMS DE DÉPART uniquement : les panoplies de la fiche §6 n'existent pas. */
const STARTING_ITEMS: readonly ItemDef[] = items.filter((item) => item.category === "equipment" && item.starting);
/** La clef du donjon et la recette qui la produit, lues au YAML. */
const KEY: ItemDef = mustFind(items, DUNGEON.keyItemId);
const KEY_RECIPE: RecipeDef = recipes.find((recipe) => recipe.resultItemId === KEY.id) ?? noRecipe();
/** Salle de la mort, mesurée : le brief attendait 3, le moteur donne 2. */
const DEATH_ROOM = 2;

/**
 * GARDE-FOU de farm, pas une mesure : depuis `DEC-07` la clef tombe en butin
 * direct (crabe 0,60 + rat 0,45 = 14,18 %/rencontre, soit ≈ 7,05 en espérance) et
 * 5 rencontres avec la graine retenue. Le cap existe pour qu'une régression de
 * `computeDropChance` (chance nulle) échoue en un éclair.
 */
const FARM_CAP = 600;
/**
 * Rencontres réellement mesurées sous `SPAWN_SEED` / `DROP_SEED` (`DEC-07`).
 * Échantillon unique d'une géométrique (p ≈ 0,1418, médiane ≈ 4,5, P(> 10) ≈ 22 %) :
 * la cible DEC-07 porte sur l'ESPÉRANCE (assertée par keyFarmBudget.spec.ts), pas sur cette mesure.
 */
const FARM_ENCOUNTERS = 5;
/** Garde-fou de salle : la salle 2 meurt en 12 actions, la 1 gagne en 16. */
const ROOM_ACTION_CAP = 200;
/** Graines du LCG : spawn et drop ne partagent pas leur flux d'aléa. */
const SPAWN_SEED = 12_345;
const DROP_SEED = 98_765;
/** Combat déterministe : le milieu de plage, aucun aléa système. */
const COMBAT_RNG = () => 0.5;

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

function first<T>(list: readonly T[], label: string): T {
  const value = list[0];
  if (value === undefined) throw new Error(`data/ ne déclare aucun ${label}`);
  return value;
}

function noRecipe(): never {
  throw new Error(`aucune recette ne produit ${KEY.id} dans data/recipes.yaml`);
}

function damageSpellsOfHero(): SpellDef[] {
  return spells.filter((spell) => spell.classId === HERO_CLASS.id && spell.damage !== undefined);
}

function heroOrThrow(): Hero {
  const { hero } = useGameStore.getState();
  if (hero === null) throw new Error("héros absent du store");
  return hero;
}

function battleOrThrow(): BattleState {
  const { battle } = useCombatStore.getState();
  if (battle === null) throw new Error("battle absent du store");
  return battle;
}

function playerOf(state: BattleState): CombatantLike {
  const player = state.combatants.find((entry) => entry.side === "player");
  if (player === undefined) throw new Error("héros absent de la bataille");
  return player;
}

function hpOf(state: BattleState): number {
  return playerOf(state).hp;
}

function zone(): SpawnZone {
  const selection = zoneForMap(spawns, START_MAP_ID);
  if (selection.fallback) throw new Error(`aucune zone de spawn déclarée pour ${START_MAP_ID}`);
  return selection.zone;
}

/** Générateur congruentiel : déterministe, injecté, jamais `Math.random`. */
function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

function xpForLevel(level: number): number {
  const tier = progression.xpThresholds.find((entry) => entry.level === level);
  if (tier === undefined) throw new Error(`niveau ${level} absent de data/progression.yaml`);
  return tier.xpRequired;
}

/** Héros créé par le store (kit de départ distribué), puis monté par `gainXp`. */
function createdHero(): Hero {
  useGameStore.getState().createCharacter({ name: "Anselme", classId: HERO_CLASS.id });
  return heroOrThrow();
}

function leveledHero(hero: Hero, level: number): Hero {
  const options = { hero, amount: xpForLevel(level) - hero.xp, gainRules: progression.gainRules };
  return gainXp({ ...options, tiers: progression.xpThresholds, apRules: progression.apRules }).hero;
}

/** Capital dépensé par le moteur, pas réécrit à la main dans le store. */
function withSpentCapital(hero: Hero, stat: StatKey): Hero {
  const options = { hero, stat, points: hero.capitalPoints, classDef: HERO_CLASS };
  return spendCapitalPoints(options).hero;
}

function withStartingKit(inventory: InventoryState): InventoryState {
  return STARTING_ITEMS.reduce((current, item) => equipItem({ inventory: current, item }), inventory);
}

/** Stats totales équipement compris, sans passer par le store. */
function statsWithKit(hero: Hero): TotalStats {
  const inventory = withStartingKit(emptyInventory());
  return totalStatsFor({ hero, inventory, items: GAME_CATALOG.items, sets: GAME_CATALOG.sets });
}

function hpWithKit(hero: Hero): number {
  const stats = statsWithKit(hero);
  return combatantFromHero({ hero, stats, position: { x: 0, y: 0 }, spellIds: [] }).maxHp;
}

/** Vitalité portée par le kit de départ (`starting: true`), lue au YAML. */
function itemVitality(item: ItemDef): number {
  return item.category === "equipment" ? item.stats.vitality ?? 0 : 0;
}

function kitVitality(): number {
  return STARTING_ITEMS.reduce((total, item) => total + itemVitality(item), 0);
}

function spellDamage(stats: TotalStats): number {
  const base = rollSpellBase(HERO_SPELL, COMBAT_RNG);
  return computeDamage({ base, stat: stats.strength });
}

/** Combattant projeté comme le store : équipement et panoplies compris. */
function heroCombatant(): CombatantState {
  const hero = heroOrThrow();
  const { inventory } = useGameStore.getState();
  const stats = totalStatsFor({ hero, inventory, items: GAME_CATALOG.items, sets: GAME_CATALOG.sets });
  const spellIds = spells.filter((spell) => spell.classId === hero.classId).map((spell) => spell.id);
  return combatantFromHero({ hero, stats, position: { x: 0, y: 0 }, spellIds });
}

function missingIngredient(inventory: InventoryState): boolean {
  return KEY_RECIPE.ingredients.some((entry) => countItem(inventory, entry.itemId) < entry.quantity);
}

interface Encounter {
  monsterId: string;
  drops: readonly string[];
}

/** Une rencontre réelle : le spawn sort du YAML, le butin du moteur. */
function fightSpawn(input: { rngSpawn: () => number; rngDrop: () => number }): Encounter {
  const pick = pickSpawn({ zones: spawns, mapId: START_MAP_ID, rng: input.rngSpawn });
  expect(pick.zoneId).toBe(zone().id);
  expect(pick.fallback).toBe(false);
  const monster = mustFind(monsters, pick.monsterId);
  const heroXp = heroOrThrow().xp;
  const rewards = resolveCombatRewards({ heroXp, hero: heroCombatant(), monster, progression, rng: input.rngDrop });
  return { monsterId: monster.id, drops: rewards.drops };
}

function withDrops(inventory: InventoryState, drops: readonly string[]): InventoryState {
  return drops.reduce((current, itemId) => addItem({ inventory: current, itemId, quantity: 1 }), inventory);
}

interface FarmReport {
  encounters: number;
  byMonster: Record<string, number>;
}

function countMonster(byMonster: Record<string, number>, monsterId: string): void {
  byMonster[monsterId] = (byMonster[monsterId] ?? 0) + 1;
}

/** Farm borné : on combat CE QUI SPAWNE, pas ce qui arrange le test. */
function farmKey(): FarmReport {
  const rngSpawn = lcg(SPAWN_SEED);
  const rngDrop = lcg(DROP_SEED);
  const byMonster: Record<string, number> = {};
  let inventory = useGameStore.getState().inventory;
  let encounters = 0;
  while (!keyInBag(inventory) && missingIngredient(inventory) && encounters < FARM_CAP) {
    const encounter = fightSpawn({ rngSpawn, rngDrop });
    inventory = withDrops(inventory, encounter.drops);
    countMonster(byMonster, encounter.monsterId);
    encounters += 1;
  }
  useGameStore.setState({ inventory });
  return { encounters, byMonster };
}

/** La clef est au sac : arrivée par le butin direct ou par le craft, peu importe. */
function keyInBag(inventory: InventoryState): boolean {
  return countItem(inventory, KEY.id) > 0;
}

/**
 * `DEC-07` : deux chemins, un seul résultat. Le farm s'arrête dès que la clef
 * tombe en butin direct ; sinon on craft depuis les ingrédients, chemin garanti.
 */
function ensureKey(): void {
  if (keyInBag(useGameStore.getState().inventory)) return;
  expect(missingIngredient(useGameStore.getState().inventory)).toBe(false);
  useGameStore.getState().craftRecipe({ recipeId: KEY_RECIPE.id });
  expect(keyInBag(useGameStore.getState().inventory)).toBe(true);
}

/** Création → niveau du donjon → capital → kit de départ, assertions comprises. */
function prepareHero(): Hero {
  const leveled = leveledHero(createdHero(), DUNGEON.recommendedLevel);
  useGameStore.setState({ hero: withSpentCapital(leveled, "strength") });
  useGameStore.setState({ inventory: withStartingKit(useGameStore.getState().inventory) });
  expect(heroOrThrow().level).toBe(DUNGEON.recommendedLevel);
  expect(heroOrThrow().capitalPoints).toBe(0);
  expect(Object.values(useGameStore.getState().inventory.equipment)).toHaveLength(STARTING_ITEMS.length);
  return heroOrThrow();
}

function currentRoomNumber(): number {
  const { dungeonRun } = useCombatStore.getState();
  if (dungeonRun === null) throw new Error("aucun run de donjon en cours");
  return dungeonRun.roomIndex + 1;
}

/** Cibles réellement atteignables : portée ET ligne de vue du sort YAML. */
function castableEnemies(state: BattleState): CombatantLike[] {
  return livingOf(state, "enemy").filter((enemy) => castRefusal(state, enemy.id, CAST_SPEC) === null);
}

function weakestOf(list: readonly CombatantLike[]): CombatantLike | null {
  const rank = (best: CombatantLike | null, enemy: CombatantLike) =>
    best === null || enemy.hp < best.hp ? enemy : best;
  return list.reduce<CombatantLike | null>(rank, null);
}

/** Un pas de jeu : frappe la cible la plus faible à portée, sinon passe la main. */
function actOnce(storage?: StorageLike): void {
  const store = useCombatStore.getState();
  const state = battleOrThrow();
  const target = activeCombatant(state)?.side === "player" ? weakestOf(castableEnemies(state)) : null;
  if (target !== null && playerOf(state).ap >= HERO_SPELL.apCost) {
    store.battleSpellAttack({ targetId: target.id, rng: COMBAT_RNG });
    return;
  }
  store.playEnemyTurns({ rng: COMBAT_RNG, storage });
}

interface RoomReport {
  roomNumber: number;
  hpStart: number;
  hpEnd: number;
  victory: boolean;
  defeat: boolean;
  actions: number;
}

/** Joue la salle courante jusqu'à victoire/défaite, borne dure incluse. */
function playRoom(roomNumber: number, storage?: StorageLike): RoomReport {
  const hpStart = hpOf(battleOrThrow());
  let actions = 0;
  while (actions < ROOM_ACTION_CAP && !isVictory(battleOrThrow()) && !isDefeat(battleOrThrow())) {
    actOnce(storage);
    actions += 1;
  }
  const end = battleOrThrow();
  expect(actions).toBeLessThan(ROOM_ACTION_CAP);
  return { roomNumber, hpStart, hpEnd: hpOf(end), victory: isVictory(end), defeat: isDefeat(end), actions };
}

class MemoryStorage implements StorageLike {
  private readonly entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}

/** Sortie propre exigée : plus de bataille, plus de run, héros vivant sauvegardé. */
function assertCleanExit(storage: StorageLike): void {
  const combat = useCombatStore.getState();
  expect(combat.battle).toBeNull();
  expect(combat.dungeonRun).toBeNull();
  expect(combat.dungeonNotice).toContain("Donjon quitté");
  const hero = heroOrThrow();
  expect(hero.hp).toBeGreaterThan(0);
  useGameStore.getState().resetGame();
  expect(useGameStore.getState().loadGame(storage)).toBe(true);
  expect(heroOrThrow().hp).toBe(hero.hp);
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  useCombatStore.setState({
    battle: null,
    combat: null,
    mode: "exploration",
    exploration: null,
    dungeonRun: null,
    dungeonNotice: null,
    rewards: null,
  });
});

describe("walkthrough : je joue, du héros créé à la mort en salle 2", () => {
  it("niveau 16 réel → farm → clef → salle 1 gagnée → défaite salle 2 → sortie propre", () => {
    prepareHero();
    const farm = farmKey();
    expect(farm.encounters).toBe(FARM_ENCOUNTERS);
    expect(farm.encounters).toBeLessThan(FARM_CAP);
    expect(keyInBag(useGameStore.getState().inventory)).toBe(true);
    ensureKey();
    expect(useCombatStore.getState().enterDungeonRun({ dungeonId: DUNGEON.id })).toBe(true);
    expect(currentRoomNumber()).toBe(1);
    const storage = new MemoryStorage();
    const first = playRoom(currentRoomNumber(), storage);
    expect(first.victory).toBe(true);
    expect(first.hpEnd).toBeGreaterThan(0);
    expect(first.hpEnd).toBeLessThan(first.hpStart);
    useCombatStore.getState().settleDungeonRoom({ storage });
    expect(currentRoomNumber()).toBe(2);
    const second = playRoom(currentRoomNumber(), storage);
    expect(second.roomNumber).toBe(DEATH_ROOM);
    // DEC-03 : 62 PV + ceil(130 × 0,5) = 127 PV à la porte de la salle 2.
    expect(second.hpStart).toBe(127);
    expect(second.defeat).toBe(true);
    expect(second.hpEnd).toBe(0);
    useCombatStore.getState().endBattle();
    assertCleanExit(storage);
  });
});

describe("walkthrough : ce que la Vitalité et la Force achètent", () => {
  it("la Vitalité donne 1 PV par point ; la Force double les dégâts du sort", () => {
    const base = leveledHero(createHero("Anselme", HERO_CLASS), DUNGEON.recommendedLevel);
    const strengthHero = withSpentCapital(base, "strength");
    const vitalityHero = withSpentCapital(base, "vitality");
    expect(vitalityHero.capitalPoints).toBe(0);
    expect(vitalityHero.vitality).toBeGreaterThan(0);
    // D45 : 1 Vitalité = 1 PV, et le kit de départ porte déjà 5 Vitalité (chapeau).
    expect(hpWithKit(strengthHero)).toBe(base.maxHp + kitVitality());
    expect(hpWithKit(vitalityHero)).toBe(hpWithKit(strengthHero) + vitalityHero.vitality);
    // ...alors que la Force change tout : 10 → 17 dégâts par Pression.
    expect(spellDamage(statsWithKit(strengthHero))).toBe(17);
    expect(spellDamage(statsWithKit(vitalityHero))).toBe(10);
  });
});
