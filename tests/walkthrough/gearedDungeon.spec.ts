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
 * RÉSULTAT MESURÉ LE 22/11/2026, SOIN ENTRE LES SALLES ACTIF — six cellules,
 * aucune victoire, mais le mur a reculé :
 *   niv.  build    PV max  salles  dernière salle     PV de monstres restants  actions
 *   16    survie    303    2/4    3  (défaite)        267                      79
 *   16    offense   228    2/4    3  (défaite)        232                      57
 *   17    survie    343    2/4    3  (défaite)        180                      65
 *   17    offense   263    2/4    3  (défaite)        166                      55
 *   18    survie    433    2/4    3  (défaite)         36                      64
 *   18    offense   348    3/4    4  (défaite)        246                      64
 *
 * AVANT LE SOIN (même fichier, mesure du 22/11/2026) : 16 survie mourait en
 * salle 2 avec 55 PV de monstres restants, les cinq autres cellules mouraient
 * en salle 3 et la salle 4 n'était jamais atteinte (148 à 274 PV restants).
 * Le soin de franchissement (`healBetweenRooms: 0.5`, DEC-03) fait donc passer
 * 16 survie de « défaite en salle 2 » à « salles 1-2 franches, défaite en
 * salle 3 », et 18 offense atteint la BOSS ROOM pour la première fois — mais y
 * meurt.
 *
 * RÉPONSE : règle (a) de DEC-03 NON satisfaite, et AUCUN ratio ne la satisfait.
 * Mesuré aussi à 0,35 / 0,65 / 0,8 / 1,0 : la salle 3 tue encore 18 survie à
 * 36 PV de monstres près, et 18 offense meurt dans la boss room même entré à
 * PV plein (348 PV, 128 PV de monstres restants à 1,0). La raison est
 * structurelle : le soin ne se déclenche qu'aux portes (« jamais en cours de
 * salle »), donc une salle qui inflige plus de dégâts que le pool effectif tue
 * de l'intérieur, sans que le ratio puisse intervenir. Baisser les dégâts des
 * monstres est INTERDIT par le brief DEC-03 : le levier restant est un
 * arbitrage du propriétaire (boss room, paliers de dégâts), pas une valeur de
 * ce fichier.
 *
 * LE PLAFOND D'ACTIONS RESTE LE DÉTECTEUR D'ENLISEMENT : il n'est ni contourné ni
 * calibré. S'il reparaît, c'est que le moteur gèle à nouveau.
 *
 * CE QUE ÇA DIT DE D71 : toujours pas résolue. Le héros nu (`play.spec.ts`) meurt
 * en salle 2 malgré le soin, l'équipé niveau 16 meurt en salle 3, l'équipé
 * niveau 17-18 y meurt aussi (18 survie à 36 PV près), et seul 18 offense
 * atteint la boss room pour y mourir. Les deux leviers brandis plus tôt ont été
 * mesurés : les panoplies sont là (5C-set) et le soin de salle est là (DEC-03).
 * Reste l'équilibrage des salles 3-4 et de la boss room.
 *
 * CE QU'IL NE PROUVE PAS : ni l'acquisition réelle de l'équipement (les pièces
 * sont ajoutées au sac puis équipées par l'action `equip` du store — la mesure
 * porte sur l'effet de l'équipement, pas sur son farm, contrairement à la clef
 * qui est, elle, réellement farmée), ni le déplacement en salle (aucune action de
 * mouvement : les monstres viennent au héros), ni l'équilibrage des salles 3-4
 * (la salle 3 n'est jamais nettoyée, la salle 4 jamais atteinte).
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

/** GARDE-FOUS de mesure, pas des résultats : le farm réel demande 324 tirages. */
const FARM_CAP = 600;
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
  while (missingIngredient(inventory) && encounters < FARM_CAP) {
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

function craftAndEnter(): number {
  const encounters = farmKey();
  expect(missingIngredient(useGameStore.getState().inventory)).toBe(false);
  useGameStore.getState().craftRecipe({ recipeId: KEY_RECIPE.id });
  expect(countItem(useGameStore.getState().inventory, KEY.id)).toBe(KEY_RECIPE.resultQuantity);
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
  build: BuildId;
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

/** Sortie propre vérifiée par `loadGame` : plus de bataille, plus de run, aucune sauvegarde à 0 PV. */
function assertCleanExit(storage: StorageLike): void {
  const combat = useCombatStore.getState();
  expect(combat.battle).toBeNull();
  expect(combat.dungeonRun).toBeNull();
  expect(combat.dungeonNotice).toContain("Donjon quitté");
  const alive = heroOrThrow();
  expect(alive.hp).toBeGreaterThan(0);
  useGameStore.getState().resetGame();
  expect(useGameStore.getState().loadGame(storage)).toBe(true);
  expect(heroOrThrow().hp).toBe(alive.hp);
}

function measureRun(input: { build: BuildId; level: number; encounters: number; storage: MemoryStorage }): Measurement {
  const { build, level, encounters, storage } = input;
  const maxHp = playerOf(battleOrThrow()).maxHp;
  const gear = wornGear(level);
  const rooms = playDungeon(storage);
  const last = rooms[rooms.length - 1];
  useCombatStore.getState().endBattle();
  assertCleanExit(storage);
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
  actions: number;
  /** Déficit chiffré, seulement quand la salle se termine par une défaite. */
  turnsShort?: number;
  hpNeeded?: number;
}

/**
 * La table EST la mesure : chaque chiffre vient d'une exécution réelle, aucune
 * valeur n'a été calée pour que le test passe. Les six cellules finissent par une
 * défaite : `actions` est le total réellement joué, jamais un plafond atteint
 * (le plafond de 200 actions reste le détecteur d'enlisement, cf. en-tête).
 * Le soin de franchissement (DEC-03) est mesuré par `crossingHeal` ci-dessous :
 * chaque salle suivante démarre au-dessus des PV de fin de la précédente.
 */
const CELLS: readonly Cell[] = [
  { level: 16, build: "survie", maxHp: 303, outcome: "defaite", room: 3, enemyHpLeft: 267, actions: 79, turnsShort: 18.15, hpNeeded: 500.3 },
  { level: 16, build: "offense", maxHp: 228, outcome: "defaite", room: 3, enemyHpLeft: 232, actions: 57, turnsShort: 8.41, hpNeeded: 279.07 },
  { level: 17, build: "survie", maxHp: 343, outcome: "defaite", room: 3, enemyHpLeft: 180, actions: 65, turnsShort: 6.63, hpNeeded: 306 },
  { level: 17, build: "offense", maxHp: 263, outcome: "defaite", room: 3, enemyHpLeft: 166, actions: 55, turnsShort: 4.88, hpNeeded: 214.01 },
  { level: 18, build: "survie", maxHp: 433, outcome: "defaite", room: 3, enemyHpLeft: 36, actions: 64, turnsShort: 0.97, hpNeeded: 46.67 },
  { level: 18, build: "offense", maxHp: 348, outcome: "defaite", room: 4, enemyHpLeft: 246, actions: 64, turnsShort: 9.28, hpNeeded: 340.38 },
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

function assertDeficit(cell: Cell, room: RoomReport): void {
  if (cell.turnsShort === undefined || cell.hpNeeded === undefined) return;
  const missing = deficitOf(room);
  expect(missing.turnsShort).toBeCloseTo(cell.turnsShort, 2);
  expect(missing.hpNeeded).toBeCloseTo(cell.hpNeeded, 1);
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

  it("ne corrige pas `recommendedLevel` : aucun niveau mesuré ne gagne, même soigné", () => {
    expect(CELLS.filter((cell) => cell.outcome === "victoire")).toEqual([]);
    expect(DUNGEON.recommendedLevel).toBe(16);
  });
});

describe.each(CELLS)("niveau $level, build $build", (cell) => {
  it(`${cell.outcome} en salle ${cell.room} — ${cell.enemyHpLeft} PV de monstres restants, ${cell.actions} actions`, () => {
    const measure = measureAt(cell.level, cell.build);
    expect(measure.maxHp).toBe(cell.maxHp);
    expect(measure.gear).toHaveLength(7);
    expect(measure.encounters).toBeLessThan(FARM_CAP);
    expect(outcomeOf(measure)).toBe(cell.outcome);
    const last = lastRoomOf(measure.rooms);
    expect(last.roomNumber).toBe(cell.room);
    expect(last.enemyHpLeft).toBe(cell.enemyHpLeft);
    expect(measure.actions).toBe(cell.actions);
    assertCrossingHeal(measure.rooms);
    assertDeficit(cell, last);
  });
});
