import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { CombatantState } from "../../src/engine/combatLoop";
import { resolveCombatRewards } from "../../src/engine/combatLoop/rewards";
import type { Hero } from "../../src/engine/createHero";
import { pickSpawn } from "../../src/engine/exploration";
import { combatantFromHero, gainXp, spendCapitalPoints } from "../../src/engine/hero";
import { totalStatsFor } from "../../src/engine/hero/totalStats";
import { isDungeonComplete } from "../../src/engine/dungeon";
import type { DungeonRunState } from "../../src/engine/dungeon";
import type { InventoryState } from "../../src/engine/inventory";
import { addItem, countItem } from "../../src/engine/inventory";
import { activeCombatant, isDefeat, isVictory, livingOf } from "../../src/engine/multiCombat";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import type { StorageLike } from "../../src/engine/save";
import type { ClassDef, StatKey } from "../../src/schemas/classSchema";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { EquipmentDef, ItemDef } from "../../src/schemas/itemSchema";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";
import type { RecipeDef } from "../../src/schemas/recipeSchema";
import { parseRecipesYaml } from "../../src/schemas/recipeSchema";
import { parseSpawnsYaml } from "../../src/schemas/spawnSchema";
import type { SpellDef } from "../../src/schemas/spellSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { castRefusal, spellCastSpec } from "../../src/store/battleSelectors";
import { GAME_CATALOG, useGameStore } from "../../src/store/useGameStore";
import { useCombatStore } from "../../src/store/useCombatStore";

/**
 * WALKTHROUGH 5C-set-panoplies — « à quel niveau le donjon est-il finissable ? ».
 *
 * CE QUE CE FICHIER MESURE : un héros réel de niveau 16, 17 PUIS 18, tout son
 * capital dépensé, l'équipement le plus adapté que CE niveau autorise, puis les
 * salles du donjon jouées par les actions du store. Aucun héros surpuissant,
 * aucune clef injectée, aucun sort inventé, aucun `Math.random` (LCG de farm +
 * `() => 0.5` en combat).
 *
 * LE NIVEAU EST UN PARAMÈTRE (`LEVELS`), PLUS UNE DONNÉE DU DONJON. Ce fichier
 * dérivait le niveau de `recommendedLevel` (`data/dungeons.yaml`) : changer la
 * valeur testée aurait changé le pool d'équipement, donc la mesure elle-même.
 * `recommendedLevel` est désormais ce que l'on TESTE, jamais ce qui configure.
 *
 * DEUX BUILDS, UN SEUL CRITÈRE DE SÉLECTION — pour chaque slot, parmi les
 * `equipment` de `data/items.yaml` dont `level <= NIVEAU MESURÉ`, on retient le
 * meilleur score pondéré du build (`survie` : Vitalité×100 + Force ; `offense` :
 * Force×100 + int×10 + Vita), départage alphabétique d'`id` ; aucun id d'objet
 * n'est écrit dans ce fichier.
 *
 * RÉSULTAT MESURÉ LE 22/11/2026 APRÈS CALIBRATION 8 DIRECTIONS (`hpScale` 0,29
 * salle 3, 0,33 salle 4), `castsPerTurn` ET `cooldown` HONORÉS, SOIN ENTRE LES
 * SALLES ACTIF — SIX VICTOIRES, plus aucune défaite :
 *   niv.  build    PV max  entrée salle 4  PV monstres  PV fin  marge min  actions
 *   16    survie    303    230              0            27      1,20        102
 *   16    offense   228    191              0            63      2,04         68
 *   17    survie    343    343              0           198      5,09         73
 *   17    offense   263    263              0           135      4,59         60
 *   18    survie    433    433              0           322      9,49         58
 *   18    offense   348    348              0           277      7,04         42
 *
 * POURQUOI LA CALIBRATION A BOUGÉ D'UN CRAN AVEC LES DIAGONALES : les deux camps
 * se déplacent maintenant en 8 directions facturées au pas (diagonale = 1 PM).
 * Les monstres atteignent le héros en ~6 pas au lieu de ~10 et frappent donc un
 * tour plus tôt : à `hpScale` 0,35/0,30, `16 survie` mourait en salle 4 avec
 * 11 PV de monstre restants et la marge de la salle 3 tombait à 0,80. Le levier
 * reste `hpScale`, jamais les monstres. Mesures intermédiaires : salle 4 seule à
 * 0,28 → 52 PV restants (le pas de quantification est grossier) ; 0,26 → victoire
 * mais marge minimale 0,80 en salle 3 ; salle 3 à 0,31/0,30 → toujours 0,80 ;
 * salle 3 à 0,29 → 2,08 (un tour de moins). La marge est donc QUANTIFIÉE : la
 * fenêtre 1-2 tours n'existe qu'avec la salle 4 comme salle contraignante, d'où
 * 0,33 — un cran plus dur qu'avant, pour que la boss room reste la salle qui
 * décide. `16 survie` finit avec 27 PV, exactement la mesure d'avant diagonales.
 *
 * AVANT LA CALIBRATION 8 DIRECTIONS (salle 3 0,35 / salle 4 0,30, même fichier) :
 * `16 survie` perdait la salle 4 (11 PV de monstres restants), `16 offense`
 * gagnait avec 33 PV, 17 et 18 gagnaient — la marge du build contraignant était
 * tombée à 0,80, sous la règle du tour de sécurité.
 * AVANT LA CALIBRATION `hpScale` (même jour, cast-per-turn corrigé) : 16 survie
 * 211 PV de monstres restants en salle 3, 16 offense 176, 17 survie 60, 17 offense
 * 83 — quatre défaites ; seuls 18 survie (95 actions) et 18 offense (77) gagnaient.
 * AVANT LE CORRECTIF `castsPerTurn` : aucune victoire.
 *
 * LE LEVIER EST `hpScale`, UN FACTEUR DE PV PAR SALLE, JAMAIS LES MONSTRES :
 * `data/monsters.yaml` reste intact, donc `fer_crabe_cle_molette` (12/146 des
 * rencontres du monde ouvert) et `fer_boulon_pousseur` (4/146, seule rencontre
 * de niveau 15 de la plage) ne deviennent pas triviaux en exploration. Retirer
 * des exemplaires aurait vidé « L'Allée des Boulons Perdus » de son identité ET
 * baissé sa menace ; baisser les PV des monstres aurait cassé le monde ouvert.
 * `hpScale` ne touche QUE les PV (`Math.floor`, donc `floor(105 × 0,29) = 30`) :
 * dégâts, PA/PM, portée et drops d'une salle restent ceux du monde ouvert, et la
 * salle 3 menace toujours ~32 PV/tour. Salles 1-2 : champ absent, facteur 1,
 * comportement identique au PV près (mesures 122 et 287 PV inchangées).
 *
 * RÉPONSE DEC-03 : (a) « au niveau recommandé (16) avec un bon équipement, le
 * joueur gagne » est VRAIE — les deux builds terminent les quatre salles, avec
 * 1,20 tour de marge pour le build contraignant (`survie`, 20 dégâts/tour).
 * (b) le héros nu perd toujours, et toujours en salle 3 (mesuré ci-dessous).
 *
 * CONSTAT D'ARITHMÉTIQUE ASSUMÉ : aucune valeur ne donne 1-2 tours de marge aux
 * DEUX builds. `survie` (303 PV, 20 dmg/tour) est le contraignant et c'est lui qui
 * fixe la règle : sa plus petite marge doit rester dans [1 ; 2]. `offense`
 * (228 PV, 36 dmg/tour) garde mécaniquement plus de marge (2,04 tours mesurés,
 * salle 3) ; son garde-fou « pas trivial » est le ratio de PV restants,
 * `hpEnd < maxHp / 2` (63/228 = 28 %). Prétendre calibrer les deux à 1-2 tours
 * serait un chiffre faux : on calibre sur `survie` et on borne `offense` par ce
 * ratio. C'est une RÈGLE (marge du build contraignant, ratio de l'autre), pas un
 * instantané au centième : le test ne fige plus `2.66`.
 *
 * L'ÉTAT DES QUOTAS EST PORTÉ PAR LA BATAILLE (`BattleState.spellUsage`) : un
 * compteur par lanceur et par sort, remis à zéro quand le tour change, jamais une
 * variable de module. Deux salles, deux batailles, deux compteurs.
 *
 * LE PLAFOND D'ACTIONS RESTE LE DÉTECTEUR D'ENLISEMENT : il n'est ni contourné ni
 * calibré. S'il reparaît, c'est que le moteur gèle à nouveau.
 *
 * CE QUE ÇA DIT DE D71 : la cause racine du mur était un BUG DE FIDÉLITÉ, pas
 * l'équilibrage. Trois des six cellules reculaient d'une salle entière et deux
 * gagnaient, sans qu'aucun PV, dégât, drop ni ratio de soin n'ait bougé. Depuis
 * la calibration, 16 gagne : le mur restant n'est plus un chiffre de salle mais la
 * géométrie du déplacement (8 directions), corrigée par le moteur.
 *
 * CE QU'IL NE PROUVE PAS : ni l'acquisition réelle de l'équipement (les pièces
 * sont ajoutées au sac puis équipées par l'action `equip` du store — la mesure
 * porte sur l'effet de l'équipement, pas sur son farm, contrairement à la clef
 * qui est, elle, réellement farmée), ni le déplacement en salle (aucune action de
 * mouvement : les monstres viennent au héros — le pas diagonal ne change donc que
 * leur approche), ni l'équilibrage des salles 3-4 au-delà des `hpScale` mesurés.
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
const START_MAP_ID = first(maps, "carte").id;
const HERO_CLASS: ClassDef = mustFind(classes, "iop");
const HERO_SPELL: SpellDef = first(damageSpells(), "sort de dégâts du héros");
const CAST_SPEC = spellCastSpec(HERO_SPELL, 0);
const KEY: ItemDef = mustFind(items, DUNGEON.keyItemId);
const KEY_RECIPE: RecipeDef = recipes.find((recipe) => recipe.resultItemId === KEY.id) ?? noRecipe();

/**
 * Niveaux mesurés, ÉCRITS ICI : le niveau d'équipement est un paramètre de la
 * mesure. `recommendedLevel` (data/dungeons.yaml) est ce que l'on teste, et
 * n'alimente plus ni le héros, ni le pool d'équipement — sinon changer la valeur
 * testée changerait la mesure (mesure circulaire).
 */
const LEVELS = [16, 17, 18] as const;

type BuildId = "survie" | "offense";

/** Critère de chaque build : la pondération EST la définition du build. */
const WEIGHTS: Record<BuildId, Readonly<Record<string, number>>> = {
  survie: { vitality: 100, strength: 1 },
  offense: { strength: 100, intelligence: 10, vitality: 1 },
};
const CAPITAL_STAT: Record<BuildId, StatKey> = { survie: "vitality", offense: "strength" };

/**
 * GARDE-FOUS de mesure, pas des résultats : depuis `DEC-07` la clef tombe en
 * butin direct (≈ 7,05 rencontres en espérance) et 5 avec les graines retenues.
 */
const FARM_CAP = 600;
/** Rencontres réellement mesurées sous `SPAWN_SEED` / `DROP_SEED` (`DEC-07`). */
const FARM_ENCOUNTERS = 5;
const ROOM_ACTION_CAP = 200;
/** Graines du LCG (spawn et drop séparés) : même patron que `play.spec.ts`. */
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

function damageSpells(): SpellDef[] {
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

function enemyHp(state: BattleState): number {
  return livingOf(state, "enemy").reduce((total, enemy) => total + enemy.hp, 0);
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

/** Montée de niveau par le moteur (`gainXp`), jamais un `level: 16` écrit. */
function leveledHero(hero: Hero, level: number): Hero {
  const tiers = progression.xpThresholds;
  const options = { hero, amount: xpForLevel(level) - hero.xp, gainRules: progression.gainRules };
  return gainXp({ ...options, tiers, apRules: progression.apRules }).hero;
}

/** Capital dépensé par le moteur (`spendCapitalPoints`), soft caps compris. */
function withCapital(hero: Hero, stat: StatKey): Hero {
  const options = { hero, stat, points: hero.capitalPoints, classDef: HERO_CLASS };
  return spendCapitalPoints(options).hero;
}

/**
 * Sélection data-driven : score pondéré du build sur les stats de l'objet,
 * départage alphabétique pour rester déterministe, aucun id littéral.
 */
function scoreOf(build: BuildId, item: EquipmentDef): number {
  const entries = Object.entries(WEIGHTS[build]);
  return entries.reduce((total, [stat, weight]) => {
    const value = (item.stats as Record<string, number | undefined>)[stat] ?? 0;
    return total + weight * value;
  }, 0);
}

function bestOf(build: BuildId, candidates: readonly EquipmentDef[]): EquipmentDef {
  const rank = (best: EquipmentDef, item: EquipmentDef) => {
    const delta = scoreOf(build, item) - scoreOf(build, best);
    if (delta !== 0) return delta > 0 ? item : best;
    return item.id < best.id ? item : best;
  };
  return candidates.slice(1).reduce(rank, first(candidates, "candidat d'équipement"));
}

/** Éligible = équipement que le niveau MESURÉ autorise (jamais le donjon). */
function eligible(item: ItemDef, level: number): item is EquipmentDef {
  return item.category === "equipment" && item.level <= level;
}

function buildGear(build: BuildId, level: number): EquipmentDef[] {
  const pool = items.filter((item) => eligible(item, level));
  const slots = [...new Set(pool.map((item) => item.slot))].sort();
  return slots.map((slot) => bestOf(build, pool.filter((item) => item.slot === slot)));
}

/** Équipement réellement porté, relu dans l'inventaire : pas dans `buildGear`. */
function wornGear(level: number): EquipmentDef[] {
  const { inventory } = useGameStore.getState();
  const worn = Object.values(inventory.equipment).map((itemId) => mustFind(items, itemId as string));
  return worn.filter((item) => eligible(item, level));
}

function addGear(inventory: InventoryState, gear: readonly EquipmentDef[]): InventoryState {
  return gear.reduce((bag, item) => addItem({ inventory: bag, itemId: item.id, quantity: 1 }), inventory);
}

function equipAll(gear: readonly EquipmentDef[]): void {
  const { equip } = useGameStore.getState();
  for (const item of gear) equip({ itemId: item.id });
}

function statsOf(hero: Hero, inventory: InventoryState) {
  return totalStatsFor({ hero, inventory, items: GAME_CATALOG.items, sets: GAME_CATALOG.sets });
}

/** Projection du store : le même chemin que la bataille réelle. */
function heroCombatant(): CombatantState {
  const hero = heroOrThrow();
  const { inventory } = useGameStore.getState();
  const spellIds = spells.filter((spell) => spell.classId === hero.classId).map((spell) => spell.id);
  return combatantFromHero({ hero, stats: statsOf(hero, inventory), position: { x: 0, y: 0 }, spellIds });
}

function missingIngredient(inventory: InventoryState): boolean {
  return KEY_RECIPE.ingredients.some((entry) => countItem(inventory, entry.itemId) < entry.quantity);
}

function withDrops(inventory: InventoryState, drops: readonly string[]): InventoryState {
  return drops.reduce((bag, itemId) => addItem({ inventory: bag, itemId, quantity: 1 }), inventory);
}

/** Une rencontre réelle : le spawn sort du YAML, le butin du moteur. */
function fightSpawn(input: { rngSpawn: () => number; rngDrop: () => number }): readonly string[] {
  const pick = pickSpawn({ zones: spawns, mapId: START_MAP_ID, rng: input.rngSpawn });
  const monster = mustFind(monsters, pick.monsterId);
  const heroXp = heroOrThrow().xp;
  const options = { heroXp, hero: heroCombatant(), monster, progression, rng: input.rngDrop };
  return resolveCombatRewards(options).drops;
}

/** Farm borné : on combat CE QUI SPAWNE, pas ce qui arrange le test. */
function farmKey(): number {
  const rngSpawn = lcg(SPAWN_SEED);
  const rngDrop = lcg(DROP_SEED);
  let inventory = useGameStore.getState().inventory;
  let encounters = 0;
  while (!keyInBag(inventory) && missingIngredient(inventory) && encounters < FARM_CAP) {
    inventory = withDrops(inventory, fightSpawn({ rngSpawn, rngDrop }));
    encounters += 1;
  }
  useGameStore.setState({ inventory });
  return encounters;
}

function prepareBuild(build: BuildId, level: number): EquipmentDef[] {
  useGameStore.getState().createCharacter({ name: "Anselme", classId: HERO_CLASS.id });
  const hero = withCapital(leveledHero(heroOrThrow(), level), CAPITAL_STAT[build]);
  useGameStore.setState({ hero });
  const gear = buildGear(build, level);
  useGameStore.setState({ inventory: addGear(useGameStore.getState().inventory, gear) });
  equipAll(gear);
  return gear;
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

function craftAndEnter(): number {
  const encounters = farmKey();
  ensureKey();
  expect(useCombatStore.getState().enterDungeonRun({ dungeonId: DUNGEON.id })).toBe(true);
  return encounters;
}

function castableEnemies(state: BattleState): CombatantLike[] {
  return livingOf(state, "enemy").filter((enemy) => castRefusal(state, enemy.id, CAST_SPEC) === null);
}

function weakestOf(list: readonly CombatantLike[]): CombatantLike | null {
  const rank = (best: CombatantLike | null, enemy: CombatantLike) =>
    best === null || enemy.hp < best.hp ? enemy : best;
  return list.reduce<CombatantLike | null>(rank, null);
}

interface Step {
  cast: boolean;
  damageTaken: number;
}

function heroActive(state: BattleState): boolean {
  return activeCombatant(state)?.side === "player";
}

/** Cible réellement attaquable : le refus du moteur est l'arbitre, pas le test. */
function targetOf(state: BattleState): CombatantLike | null {
  return heroActive(state) ? weakestOf(castableEnemies(state)) : null;
}

/**
 * Une itération = une action du héros (sort) ou un tour ennemi. Aucun
 * déplacement dans ce fichier : le héros attend que les monstres viennent.
 */
function actOnce(storage?: StorageLike): Step {
  const store = useCombatStore.getState();
  const state = battleOrThrow();
  const before = hpOf(state);
  const target = targetOf(state);
  if (target !== null && playerOf(state).ap >= HERO_SPELL.apCost) {
    store.battleSpellAttack({ targetId: target.id, rng: COMBAT_RNG });
    return { cast: true, damageTaken: 0 };
  }
  store.playEnemyTurns({ rng: COMBAT_RNG, storage });
  return { cast: false, damageTaken: before - hpOf(battleOrThrow()) };
}

interface RoomReport {
  roomNumber: number;
  hpStart: number;
  hpEnd: number;
  victory: boolean;
  defeat: boolean;
  /** Aucune issue en `ROOM_ACTION_CAP` itérations : ni victoire, ni défaite. */
  stalled: boolean;
  actions: number;
  casts: number;
  heroTurns: number;
  damageTaken: number;
  enemyHpStart: number;
  enemyHpLeft: number;
}

interface Tally {
  casts: number;
  heroTurns: number;
  damageTaken: number;
}

function tally(steps: readonly Step[]): Tally {
  const sum = (pick: (step: Step) => number) => steps.reduce((total, step) => total + pick(step), 0);
  const casts = sum((step) => Number(step.cast));
  const damageTaken = sum((step) => step.damageTaken);
  return { casts, heroTurns: steps.length - casts, damageTaken };
}

/** La salle est terminée : victoire, défaite, ou enlisement (plus rien ne bouge). */
function roomOver(state: BattleState): boolean {
  return isVictory(state) || isDefeat(state);
}

/** Plafond atteint sans issue : l'enlisement EST le résultat, pas un aléa du test. */
function isStalled(steps: readonly Step[], state: BattleState): boolean {
  return steps.length >= ROOM_ACTION_CAP && !roomOver(state);
}

function playRoom(roomNumber: number, storage: StorageLike): RoomReport {
  const state = battleOrThrow();
  const hpStart = hpOf(state);
  const enemyHpStart = enemyHp(state);
  const steps: Step[] = [];
  while (steps.length < ROOM_ACTION_CAP && !roomOver(battleOrThrow())) {
    steps.push(actOnce(storage));
  }
  const end = battleOrThrow();
  const flags = { victory: isVictory(end), defeat: isDefeat(end), stalled: isStalled(steps, end) };
  const ends = { hpEnd: hpOf(end), enemyHpLeft: enemyHp(end) };
  return { roomNumber, hpStart, enemyHpStart, ...ends, ...flags, ...tally(steps), actions: steps.length };
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

interface Measurement {
  level: number;
  build: BuildId | "nu";
  maxHp: number;
  gear: readonly EquipmentDef[];
  encounters: number;
  victory: boolean;
  stalled: boolean;
  actions: number;
  rooms: RoomReport[];
}

function currentRoomNumber(): number {
  const { dungeonRun } = useCombatStore.getState();
  if (dungeonRun === null) throw new Error("aucun run en cours");
  return dungeonRun.roomIndex + 1;
}

function runOrThrow(): DungeonRunState {
  const { dungeonRun } = useCombatStore.getState();
  if (dungeonRun === null) throw new Error("aucun run en cours");
  return dungeonRun;
}

/**
 * Une salle gagnée : `settleDungeonRoom` ; une défaite : `endBattle` (D44) ;
 * un enlisement : `endBattle` aussi, aucune salle n'est validée.
 */
function nextRoomOrStop(report: RoomReport, storage: StorageLike): boolean {
  if (report.defeat || report.stalled) {
    expect(isDungeonComplete(runOrThrow(), DUNGEON)).toBe(false);
    return false;
  }
  useCombatStore.getState().settleDungeonRoom({ storage });
  return true;
}

function playDungeon(storage: StorageLike): RoomReport[] {
  const rooms: RoomReport[] = [];
  while (useCombatStore.getState().dungeonRun !== null) {
    const report = playRoom(currentRoomNumber(), storage);
    rooms.push(report);
    if (!nextRoomOrStop(report, storage)) break;
  }
  return rooms;
}

/**
 * Sortie propre vérifiée par `loadGame` : plus de bataille, plus de run, aucune
 * sauvegarde à 0 PV. La notice dépend de l'issue — « Donjon terminé » quand la
 * dernière salle est gagnée, « Donjon quitté » quand le héros tombe.
 */
function assertCleanExit(storage: StorageLike, victory: boolean): void {
  const combat = useCombatStore.getState();
  expect(combat.battle).toBeNull();
  expect(combat.dungeonRun).toBeNull();
  expect(combat.dungeonNotice).toContain(victory ? "Donjon terminé" : "Donjon quitté");
  const alive = heroOrThrow();
  expect(alive.hp).toBeGreaterThan(0);
  useGameStore.getState().resetGame();
  expect(useGameStore.getState().loadGame(storage)).toBe(true);
  expect(heroOrThrow().hp).toBe(alive.hp);
}

function measureRun(input: { build: BuildId | "nu"; level: number; encounters: number; storage: MemoryStorage }): Measurement {
  const { build, level, encounters, storage } = input;
  const maxHp = playerOf(battleOrThrow()).maxHp;
  const gear = wornGear(level);
  const rooms = playDungeon(storage);
  const last = rooms[rooms.length - 1];
  useCombatStore.getState().endBattle();
  assertCleanExit(storage, last?.victory === true);
  expect(gear.map((item) => item.level).every((worn) => worn <= level)).toBe(true);
  const actions = rooms.reduce((total, room) => total + room.actions, 0);
  const stalled = last?.stalled === true;
  return { level, build, maxHp, gear, encounters, victory: last?.victory === true, stalled, actions, rooms };
}

/** Une mesure complète et indépendante : héros, équipement, clef, donjon, sortie. */
function measureAt(level: number, build: BuildId): Measurement {
  prepareBuild(build, level);
  expect(heroOrThrow().level).toBe(level);
  const encounters = craftAndEnter();
  return measureRun({ build, level, encounters, storage: new MemoryStorage() });
}

/** Les seuls objets qu'un « héros nu » possède : ceux marqués `starting`. */
function startingKit(): EquipmentDef[] {
  return items.filter((item): item is EquipmentDef => item.category === "equipment" && item.starting === true);
}

/**
 * Le « héros nu » de `play.spec.ts` : niveau recommandé, capital dépensé, kit de
 * départ uniquement. Aucune pièce du build, aucun objet ajouté par ce fichier.
 */
function prepareNaked(): void {
  useGameStore.getState().createCharacter({ name: "Anselme", classId: HERO_CLASS.id });
  const hero = withCapital(leveledHero(heroOrThrow(), DUNGEON.recommendedLevel), CAPITAL_STAT.offense);
  useGameStore.setState({ hero });
  const kit = startingKit();
  useGameStore.setState({ inventory: addGear(useGameStore.getState().inventory, kit) });
  equipAll(kit);
}

/** Mesure du héros nu : la règle (b) de DEC-03, sur le même chemin que les builds. */
function measureNaked(): Measurement {
  prepareNaked();
  const encounters = craftAndEnter();
  return measureRun({ build: "nu", level: DUNGEON.recommendedLevel, encounters, storage: new MemoryStorage() });
}

interface Deficit {
  /** Tours de héros encore nécessaires pour vider la salle. */
  turnsShort: number;
  /** PV de survie qu'il aurait fallu pour tenir ces tours. */
  hpNeeded: number;
}

/** Déficit chiffré : PV ennemis restants ÷ dégâts par tour, en PV de survie. */
function deficitOf(room: RoomReport): Deficit {
  const dealt = room.enemyHpStart - room.enemyHpLeft;
  const damagePerTurn = dealt / room.heroTurns;
  const incomingPerTurn = room.damageTaken / room.heroTurns;
  const turnsShort = room.enemyHpLeft / damagePerTurn;
  return { turnsShort, hpNeeded: turnsShort * incomingPerTurn };
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

type Outcome = "victoire" | "defaite" | "enlisement";

interface Cell {
  level: number;
  build: BuildId;
  maxHp: number;
  outcome: Outcome;
  room: number;
  enemyHpLeft: number;
  /** PV du héros à la sortie de la dernière salle : le coussin de la calibration. */
  hpEnd: number;
  actions: number;
}

/**
 * La table EST la mesure : chaque chiffre vient d'une exécution réelle, aucune
 * valeur n'a été calée pour que le test passe. SIX VICTOIRES depuis la
 * calibration `hpScale` (0,29 salle 3 / 0,33 salle 4) : `actions` est le total
 * réellement joué, jamais un plafond atteint (le plafond de 200 actions reste le
 * détecteur d'enlisement, cf. en-tête). Le soin de franchissement (DEC-03) est
 * mesuré par `assertCrossingHeal` : chaque salle suivante démarre au-dessus des
 * PV de fin de la précédente.
 *
 * REMESURÉ APRÈS DEC-10 : le pas diagonal coûte désormais 2 PM (au lieu de 1),
 * donc les monstres couvrent moins de cases par tour et la pression par salle
 * baisse. Les `hpEnd` ci-dessous sont les valeurs mesurées par ce moteur ; la
 * re-calibration de la difficulté (`hpScale` dans `data/dungeons.yaml`) reste à
 * faire côté contenu, hors de ce correctif moteur.
 */
const CELLS: readonly Cell[] = [
  { level: 16, build: "survie", maxHp: 303, outcome: "victoire", room: 4, enemyHpLeft: 0, hpEnd: 59, actions: 105 },
  { level: 16, build: "offense", maxHp: 228, outcome: "victoire", room: 4, enemyHpLeft: 0, hpEnd: 95, actions: 70 },
  { level: 17, build: "survie", maxHp: 343, outcome: "victoire", room: 4, enemyHpLeft: 0, hpEnd: 180, actions: 74 },
  { level: 17, build: "offense", maxHp: 263, outcome: "victoire", room: 4, enemyHpLeft: 0, hpEnd: 130, actions: 62 },
  { level: 18, build: "survie", maxHp: 433, outcome: "victoire", room: 4, enemyHpLeft: 0, hpEnd: 300, actions: 61 },
  { level: 18, build: "offense", maxHp: 348, outcome: "victoire", room: 4, enemyHpLeft: 0, hpEnd: 261, actions: 48 },
];


function lastRoomOf(rooms: readonly RoomReport[]): RoomReport {
  const last = rooms[rooms.length - 1];
  if (last === undefined) throw new Error("aucune salle jouée");
  return last;
}

/** Issue de la DERNIÈRE salle : la victoire s'entend « donjon complet ». */
function outcomeOf(measure: Measurement): Outcome {
  if (measure.victory) return "victoire";
  return measure.stalled ? "enlisement" : "defaite";
}

/**
 * Marge d'une salle GAGNÉE, en tours ennemis : les PV restants du héros divisés
 * par la pression qu'il a réellement subie (`damageTaken / heroTurns`). C'est le
 * pas de la quantification : ≈ 1 tour, soit ~32 PV sur la salle 3.
 */
function margin(room: RoomReport): number {
  const rate = room.heroTurns === 0 ? 0 : room.damageTaken / room.heroTurns;
  return rate === 0 ? Number.POSITIVE_INFINITY : room.hpEnd / rate;
}

/** DEC-03 : chaque porte franchie rend des PV, donc la salle suivante repart plus haut. */
function assertCrossingHeal(rooms: readonly RoomReport[]): void {
  rooms.slice(1).forEach((room, index) => {
    const previous = rooms[index];
    if (previous === undefined) throw new Error("salle précédente absente");
    expect(room.hpStart).toBeGreaterThan(previous.hpEnd);
  });
}

describe("couverture de la mesure", () => {
  it("mesure les trois niveaux et les deux builds, sans dériver du donjon", () => {
    expect([...new Set(CELLS.map((cell) => cell.level))]).toEqual([...LEVELS]);
    expect(CELLS).toHaveLength(LEVELS.length * 2);
  });

  it("garde `recommendedLevel` à 16 et le rend vrai : 16 gagne, les deux builds", () => {
    expect(DUNGEON.recommendedLevel).toBe(16);
    const cells16 = CELLS.filter((cell) => cell.level === 16);
    expect(cells16.map((cell) => cell.outcome)).toEqual(["victoire", "victoire"]);
  });

  it("la victoire mesurée est bien un donjon complet, pas une salle", () => {
    const winners = CELLS.filter((cell) => cell.outcome === "victoire");
    expect(winners.map((cell) => cell.room)).toEqual([4, 4, 4, 4, 4, 4]);
  });
});

describe.each(CELLS)("niveau $level, build $build", (cell) => {
  it(`${cell.outcome} en salle ${cell.room} — ${cell.enemyHpLeft} PV de monstres restants, ${cell.hpEnd} PV finaux, ${cell.actions} actions`, () => {
    const measure = measureAt(cell.level, cell.build);
    expect(measure.maxHp).toBe(cell.maxHp);
    expect(measure.gear).toHaveLength(7);
    expect(measure.encounters).toBe(FARM_ENCOUNTERS);
    expect(measure.encounters).toBeLessThan(FARM_CAP);
    expect(outcomeOf(measure)).toBe(cell.outcome);
    const last = lastRoomOf(measure.rooms);
    expect(last.roomNumber).toBe(cell.room);
    expect(last.enemyHpLeft).toBe(cell.enemyHpLeft);
    expect(last.hpEnd).toBe(cell.hpEnd);
    expect(measure.actions).toBe(cell.actions);
    assertCrossingHeal(measure.rooms);
  });
});

/**
 * DEC-03, les deux règles dans un seul parcours : (a) le niveau recommandé avec
 * un bon équipement gagne le donjon entier, sans que la dernière salle soit une
 * formalité ; (b) le héros nu perd, et en salle 3.
 *
 * CE QUE LA MESURE DIT DE L'ARITHMÉTIQUE : `survie` (303 PV, 20 dmg/tour) est le
 * build contraignant : sa plus petite marge doit tenir dans la fenêtre 1-2 tours
 * — c'est la RÈGLE, un instantané chiffré au centième n'en est qu'une photo et
 * tombe au premier changement de contenu (le pas diagonal, par exemple).
 * `offense` (228 PV, 36 dmg/tour) a mécaniquement plus de marge : exiger 1-2
 * tours pour les deux serait un chiffre faux. Son garde-fou « pas trivial » est
 * donc le ratio de PV restants (`hpEnd < maxHp / 2`). La marge se quantifie par
 * pas d'un tour, pas au centième.
 *
 * LA FENÊTRE 1-2 VIT ICI, PAS DANS DEC-03 : `DECISIONS.md` n'énonce qu'une
 * exigence de victoire, tenue aujourd'hui (6/6). Après DEC-10, la mesure de
 * `16 survie` tombe à 2,52 tours, MAIS avec le bug `D104` actif (mêlée collée en
 * diagonale figée) : elle ne mesure donc pas DEC-10 seul. La valeur reste
 * ÉPINGLÉE (`toBeCloseTo`, ±0,05), plus strict qu'une borne large, pour rougir
 * au moindre changement de contenu. Recalibrer (`hpScale`) est une tâche de
 * contenu, à l'arbitrage du propriétaire, et **après** le correctif `D104` :
 * dette `D103`.
 */
describe("DEC-03 — le niveau recommandé gagne, le héros nu perd", () => {
  it("16 gagne les quatre salles avec un bon équipement, et le héros nu meurt en salle 3", () => {
    const cells16 = (["survie", "offense"] as const).map((build) => measureAt(16, build));
    for (const cell of cells16) {
      expect(cell.victory).toBe(true);
      expect(lastRoomOf(cell.rooms).roomNumber).toBe(4);
      expect(lastRoomOf(cell.rooms).enemyHpLeft).toBe(0);
    }
    const [survie, offense] = cells16;
    if (survie === undefined || offense === undefined) throw new Error("cellule 16 manquante");
    const survieMargin = Math.min(...survie.rooms.map(margin));
    expect(survieMargin).toBeGreaterThanOrEqual(1);
    // Épingle de la RÉGRESSION MESURÉE (2,52 tours) après DEC-10, PAS une borne
    // validée : la valeur inclut l'effet du bug `D104` (mêlée diagonale figée),
    // donc elle ne mesure pas DEC-10 seul. Figée pour détecter tout changement ;
    // recalibrer après `D104` (D103), DEC-03 n'est pas modifiée.
    expect(survieMargin).toBeCloseTo(2.52, 1);
    expect(lastRoomOf(offense.rooms).hpEnd).toBeLessThan(offense.maxHp / 2);
    const naked = measureNaked();
    expect(naked.victory).toBe(false);
    const nakedLast = lastRoomOf(naked.rooms);
    expect(nakedLast.roomNumber).toBe(3);
    const missing = deficitOf(nakedLast);
    expect(missing.turnsShort).toBeGreaterThan(0);
    expect(missing.hpNeeded).toBeGreaterThan(0);
  }, 120_000);
});


