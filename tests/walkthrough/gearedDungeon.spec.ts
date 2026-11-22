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
 * WALKTHROUGH 5C-set-panoplies — « le donjon avec un héros ÉQUIPÉ ».
 *
 * CE QUE CE FICHIER MESURE (et rien d'autre) : un héros de niveau 16 réel,
 * 75 points de capital dépensés, l'équipement le plus adapté disponible au
 * niveau 16, puis les salles du donjon jouées par les actions du store.
 * Aucun héros surpuissant, aucune clef injectée, aucun sort inventé, aucun
 * `Math.random` (LCG de farm + `() => 0.5` en combat).
 *
 * DEUX BUILDS, UN SEUL CRITÈRE DE SÉLECTION — l'algorithme, en une ligne :
 * pour chaque slot, parmi les `equipment` de `data/items.yaml` dont
 * `level <= 16`, on retient le meilleur score pondéré du build
 * (`survie` : Vitalité×100 + Force ; `offense` : Force×100 + int×10 + Vita),
 * départage alphabétique d'`id` ; aucun id d'objet n'est écrit dans ce fichier.
 * Sept slots sont pourvus, mais `ring1` est une ÉGALITÉ À 0 POINT : les deux
 * anneaux du catalogue ne scorent ni Force, ni int, ni Vita (12 Agilité contre
 * 20 Chance), et l'Anneau Mazouté ne gagne que par ordre alphabétique. « 7
 * pièces optimisées » serait donc flatteur : ce slot n'apporte rien.
 *
 * RÉSULTAT MESURÉ LE 22/11/2026, contre la dette D71 :
 *   survie  — 75 points en Vitalité, 303 PV max : salle 1 GAGNÉE (303 → 225 PV,
 *             18 actions), salle 2 DÉFAITE (225 → 0, 35 actions), il restait
 *             55 PV de monstres, soit 3,08 tours de héros manquants ≈ 53 PV.
 *   offense — 75 points en Force, 228 PV max : salle 1 GAGNÉE (228 → 182 PV,
 *             12 actions), salle 2 DÉFAITE (182 → 0, 31 actions), il restait
 *             7 PV de monstres, soit 0,35 tour manquant ≈ 5 PV de survie.
 *
 * CE QUE ÇA DIT DE D71 : elle n'est PAS résolue (les deux builds meurent en
 * salle 2, comme le héros nu de `play.spec.ts`) mais elle a changé de nature.
 * ATTENTION AUX UNITÉS : ce fichier ne mesure que des PV de MONSTRES restants
 * (55 en survie, 7 en offense). Le « ~200 PV d'écart » du commentaire de
 * `play.spec.ts` est une ESTIMATION HÉRITÉE, NON MESURÉE, et exprimée en PV de
 * HÉROS : elle n'est pas comparable aux deux chiffres ci-dessus et n'est donc
 * pas mise sur la même échelle. À la seule aune mesurée ici, la salle 2 laisse
 * 55 PV de monstres au build survie et 7 PV au build offense : elle tombe à un
 * objet près. Les deux critères d'optimisation convergent au niveau 16 : le
 * seul marteau (`level: 15`, Force 22 + Vita 20) et la seule amulette
 * (`level: 16`, Force 18 + Vita 22) sont à la fois les plus défensifs et les
 * plus offensifs — les pièces Brico-Lourd complètes (`level` 17-18) ne sont
 * pas accessibles et aucun palier de panoplie ne s'active (1 pièce sur 4).
 *
 * CE QUI FERA CHANGER CE RÉSULTAT : (a) une pièce de niveau 16 supplémentaire,
 * ou le palier 2 de `fer_set_brico_lourd` (+15 Vita, +10 Force), qui exige des
 * pièces `level` 17-18, ou un héros de niveau 17-18 ; (b) les soins entre les
 * salles (vague 6), aujourd'hui interdits par le moteur. Les résistances
 * (D45b) ne déplaceraient PAS cette mesure : aucune pièce retenue n'en porte,
 * et la seule du catalogue est le palier 3 de `panoplie_piou_mazoute`
 * (`flatRes: 5`, `data/sets.yaml`), palier que ce build n'active pas. Elles
 * compteraient si des données en ajoutaient. Le jour où un build gagne,
 * remplacer l'assertion de défaite par la victoire (`isDungeonComplete`) et
 * dérouler les salles 3 et 4.
 *
 * CE QU'IL NE PROUVE PAS : ni l'acquisition réelle de l'équipement (les pièces
 * sont ajoutées au sac puis équipées par l'action `equip` du store — la mesure
 * porte sur l'effet de l'équipement, pas sur son farm, contrairement à la
 * clef qui est, elle, réellement farmée), ni le déplacement en salle (aucune
 * action de mouvement : les monstres viennent au héros), ni l'équilibrage des
 * salles 3-4 (jamais atteintes).
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
/** Niveau de la mesure : celui que le donjon recommande, jamais réécrit. */
const LEVEL = DUNGEON.recommendedLevel;

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

/** Éligible = équipement que le niveau 16 autorise. */
function eligible(item: ItemDef): item is EquipmentDef {
  return item.category === "equipment" && item.level <= LEVEL;
}

function buildGear(build: BuildId): EquipmentDef[] {
  const pool = items.filter(eligible);
  const slots = [...new Set(pool.map((item) => item.slot))].sort();
  return slots.map((slot) => bestOf(build, pool.filter((item) => item.slot === slot)));
}

/** Équipement réellement porté, relu dans l'inventaire : pas dans `buildGear`. */
function wornGear(): EquipmentDef[] {
  const { inventory } = useGameStore.getState();
  const worn = Object.values(inventory.equipment).map((itemId) => mustFind(items, itemId as string));
  return worn.filter(eligible);
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

function prepareBuild(build: BuildId): EquipmentDef[] {
  useGameStore.getState().createCharacter({ name: "Anselme", classId: HERO_CLASS.id });
  const hero = withCapital(leveledHero(heroOrThrow(), LEVEL), CAPITAL_STAT[build]);
  useGameStore.setState({ hero });
  const gear = buildGear(build);
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

function actOnce(storage?: StorageLike): Step {
  const store = useCombatStore.getState();
  const state = battleOrThrow();
  const before = hpOf(state);
  const target = activeCombatant(state)?.side === "player" ? weakestOf(castableEnemies(state)) : null;
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

function playRoom(roomNumber: number, storage: StorageLike): RoomReport {
  const state = battleOrThrow();
  const hpStart = hpOf(state);
  const enemyHpStart = enemyHp(state);
  const steps: Step[] = [];
  while (steps.length < ROOM_ACTION_CAP && !isVictory(battleOrThrow()) && !isDefeat(battleOrThrow())) {
    steps.push(actOnce(storage));
  }
  expect(steps.length).toBeLessThan(ROOM_ACTION_CAP);
  const end = battleOrThrow();
  const flags = { victory: isVictory(end), defeat: isDefeat(end) };
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
  build: BuildId;
  maxHp: number;
  gear: readonly EquipmentDef[];
  encounters: number;
  victory: boolean;
  deathRoom: number | null;
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

/** Une salle gagnée : `settleDungeonRoom` ; une défaite : `endBattle` (D44). */
function nextRoomOrStop(report: RoomReport, storage: StorageLike): boolean {
  if (report.defeat) {
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

function measureRun(build: BuildId, encounters: number, storage: MemoryStorage): Measurement {
  const maxHp = playerOf(battleOrThrow()).maxHp;
  const gear = wornGear();
  const rooms = playDungeon(storage);
  const last = rooms[rooms.length - 1];
  const deathRoom = last?.defeat === true ? last.roomNumber : null;
  useCombatStore.getState().endBattle();
  assertCleanExit(storage);
  expect(gear.map((item) => item.level).every((level) => level <= LEVEL)).toBe(true);
  const actions = rooms.reduce((total, room) => total + room.actions, 0);
  return { build, maxHp, gear, encounters, victory: last?.victory === true, deathRoom, actions, rooms };
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

describe("build survie — 75 Vitalité, l'équipement le plus défensif du niveau 16", () => {
  it("303 PV : salle 1 gagnée, défaite salle 2 avec 55 PV ennemis restants", () => {
    const gear = prepareBuild("survie");
    expect(gear).toHaveLength(7);
    expect(heroOrThrow().capitalPoints).toBe(0);
    const encounters = craftAndEnter();
    const measure = measureRun("survie", encounters, new MemoryStorage());
    expect(measure.maxHp).toBe(303);
    expect(measure.gear).toHaveLength(gear.length);
    expect(measure.encounters).toBeLessThan(FARM_CAP);
    expect(measure.victory).toBe(false);
    expect(measure.deathRoom).toBe(2);
    expect(measure.rooms.map((room) => room.roomNumber)).toEqual([1, 2]);
    const [first, second] = measure.rooms;
    expect(first?.victory).toBe(true);
    expect(first?.hpEnd).toBe(225);
    expect(second?.hpStart).toBe(first?.hpEnd);
    // Remplace le tautologique `hpEnd === 0` (vrai par définition d'une défaite) :
    // le héros a bien absorbé TOUS ses PV, aucun soin ne s'est glissé en salle.
    expect(second?.damageTaken).toBe(second?.hpStart);
    expect(second?.enemyHpLeft).toBe(55);
    const missing = deficitOf(second as RoomReport);
    expect(missing.turnsShort).toBeCloseTo(3.08, 2);
    expect(missing.hpNeeded).toBeCloseTo(53.3, 1);
  });
});

describe("build offense — 75 Force, l'équipement le plus offensif du niveau 16", () => {
  it("228 PV : salle 1 gagnée, défaite salle 2 à 7 PV ennemis près", () => {
    prepareBuild("offense");
    expect(heroOrThrow().capitalPoints).toBe(0);
    const encounters = craftAndEnter();
    const measure = measureRun("offense", encounters, new MemoryStorage());
    expect(measure.maxHp).toBe(228);
    expect(measure.rooms.map((room) => room.roomNumber)).toEqual([1, 2]);
    expect(measure.deathRoom).toBe(2);
    const second = measure.rooms[1] as RoomReport;
    expect(second.defeat).toBe(true);
    expect(second.enemyHpLeft).toBe(7);
    const missing = deficitOf(second);
    expect(missing.turnsShort).toBeCloseTo(0.35, 2);
    expect(missing.hpNeeded).toBeCloseTo(4.6, 1);
  });
});
