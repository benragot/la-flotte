import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createHero } from "../../src/engine/createHero";
import type { Hero } from "../../src/engine/createHero";
import { attemptRoom, healBetweenRooms, roomMonsters } from "../../src/engine/dungeon";
import type { DungeonRoom, DungeonRunState } from "../../src/engine/dungeon";
import { computeCombatXp, getBaseApForLevel } from "../../src/engine/economy";
import { gainXp } from "../../src/engine/hero";
import { addItem, countItem } from "../../src/engine/inventory";
import type { InventoryState } from "../../src/engine/inventory";
import { activeCombatant, findCombatant, isDefeat, isVictory, livingOf } from "../../src/engine/multiCombat";
import type { AttackSpec, BattleState, EnemyStrategy, Rng } from "../../src/engine/multiCombat";
import type { StorageLike } from "../../src/engine/save";
import type { ClassDef } from "../../src/schemas/classSchema";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { MonsterDef } from "../../src/schemas/monsterSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";
import type { RecipeDef } from "../../src/schemas/recipeSchema";
import { parseRecipesYaml } from "../../src/schemas/recipeSchema";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const progression = parseProgressionYaml(read("progression.yaml"));
const recipes = parseRecipesYaml(read("recipes.yaml"));

const DUNGEON_ID = "fer_donjon_casse_vis_sans_fin";
const KEY_ID = "cle_donjon_ile_de_la_ferraille";
/**
 * Depuis la PR #41, `data/recipes.yaml` contient la recette de la clé et
 * `data/items.yaml` ses 3 ingrédients. Ce walkthrough **monte néanmoins la clé
 * à la main** : il prouve le run de donjon, pas l'obtention de la clé.
 * L'obtention est prouvée par `tests/data/keyCrafting.spec.ts` (recette +
 * ingrédients) et, à partir de 5B-g (PR #43), par `tests/data/spawns.spec.ts`
 * (les 3 ingrédients ont une source hors donjon).
 */
const RECIPE_ID = "recette_gourdin_du_matelot";
const MAX_ACTIONS = 200;

/** Traversée, pas équilibrage : un coup suffit à tomber chaque monstre réel. */
const HERO_ATTACK: AttackSpec = { base: 400, element: "earth", apCost: 1 };
const ENEMY_ATTACK = { base: 1, element: "neutral" as const };
/** Aléa injecté dans le store : crit et drops jamais tirés par `Math.random`. */
const rng: Rng = () => 0.5;
/** Tirage des récompenses : 0,35 fait passer tous les butins et varie les kamas. */
const rewardRng: Rng = () => 0.35;

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

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

function iop(): ClassDef {
  return mustFind(classes, "iop");
}

function dungeonOrThrow(): DungeonDef {
  return mustFind(dungeons, DUNGEON_ID);
}

function recipeOrThrow(id: string): RecipeDef {
  return mustFind(recipes, id);
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

function addMany(inventory: InventoryState, itemIds: readonly string[]): InventoryState {
  return itemIds.reduce((current, itemId) => addItem({ inventory: current, itemId, quantity: 1 }), inventory);
}

function expandIngredients(recipe: RecipeDef): string[] {
  return recipe.ingredients.flatMap(({ itemId, quantity }) => Array.from({ length: quantity }, () => itemId));
}

function prepareHero(): void {
  const game = useGameStore.getState();
  game.createCharacter({ name: "Anselme", classId: "iop" });
  game.equip({ itemId: "gourdin_du_matelot" });
  const ingredients = expandIngredients(recipeOrThrow(RECIPE_ID));
  useGameStore.setState({ inventory: addMany(game.inventory, ingredients) });
}

function craftRealRecipe(): number {
  const recipe = recipeOrThrow(RECIPE_ID);
  const before = useGameStore.getState().inventory;
  const result = useGameStore.getState().craftRecipe({ recipeId: recipe.id });
  const after = useGameStore.getState().inventory;
  const expected = countItem(before, recipe.resultItemId) + recipe.resultQuantity;
  expect(countItem(after, recipe.resultItemId)).toBe(expected);
  for (const { itemId } of recipe.ingredients) expect(countItem(after, itemId)).toBe(0);
  return result.crafted;
}

function stockKey(): void {
  const inventory = useGameStore.getState().inventory;
  useGameStore.setState({ inventory: addItem({ inventory, itemId: KEY_ID, quantity: 1 }) });
}

/**
 * Entrée par le **chemin de production** (`enterDungeonRun`) : le run vit dans
 * le store, donc chaque `settleDungeonRoom` crédite réellement les récompenses.
 */
function enterWithKey(): { dungeon: DungeonDef; run: DungeonRunState } {
  const dungeon = dungeonOrThrow();
  expect(useCombatStore.getState().enterDungeonRun({ dungeonId: dungeon.id })).toBe(true);
  const run = useCombatStore.getState().dungeonRun;
  if (run === null) throw new Error("entrée acceptée sans run dans le store");
  expect(run.keysConsumed).toBe(1);
  expect(countItem(useGameStore.getState().inventory, KEY_ID)).toBe(0);
  return { dungeon, run };
}

function battlePlayer(battle: BattleState) {
  return battle.combatants.find((entry) => entry.side === "player");
}

function enemyCount(battle: BattleState): number {
  return battle.combatants.filter((entry) => entry.side === "enemy").length;
}

function lowestHpEnemy(battle: BattleState): string {
  const enemies = livingOf(battle, "enemy");
  const lowest = enemies.reduce<BattleState["combatants"][number] | null>(
    (best, entry) => (best === null || entry.hp < best.hp ? entry : best),
    null,
  );
  if (lowest === null) throw new Error("aucun ennemi vivant");
  return lowest.id;
}

const enemyStrategy: EnemyStrategy = (state, enemyId) => {
  const enemy = findCombatant(state, enemyId);
  const target = livingOf(state, "player")[0];
  if (enemy === undefined || enemy.ap <= 0 || target === undefined) return null;
  return { kind: "attack", targetId: target.id, attack: { ...ENEMY_ATTACK, apCost: enemy.ap } };
};

function actOnce(): void {
  const battle = battleOrThrow();
  const active = activeCombatant(battle);
  const store = useCombatStore.getState();
  if (active?.side !== "player") return store.battleEnemyTurn({ strategy: enemyStrategy, rng });
  store.battleAttack({ targetId: lowestHpEnemy(battle), attack: HERO_ATTACK, rng });
}

function playBattle(): void {
  for (let step = 0; step < MAX_ACTIONS; step += 1) {
    const before = battleOrThrow();
    if (isVictory(before) || isDefeat(before)) return;
    actOnce();
    if (useCombatStore.getState().battle === before) useCombatStore.getState().advanceBattleTurn();
  }
  throw new Error(`combat non résolu en ${MAX_ACTIONS} actions`);
}

/** Vaincus lus dans l'ÉTAT DE BATAILLE, jamais dans le YAML attendu. */
function fallenIds(): string[] {
  return battleOrThrow()
    .combatants.filter((entry) => entry.side === "enemy" && entry.hp === 0)
    .map((entry) => entry.id.replace(/-\d+$/, ""));
}

interface RoomOutcome {
  /** PV du héros à l'entrée de la salle. */
  hpStart: number;
  /** PV DANS LA BATAILLE à la victoire, AVANT tout soin de franchissement. */
  hpBattleEnd: number;
  /** Plafond du pool de combat, relevé avant la montée de niveau de la salle. */
  maxHpBattle: number;
  /** PV persistés APRÈS le soin de franchissement (donc à la sortie de la salle). */
  hpEnd: number;
  maxHpEnd: number;
  enemies: number;
  fallen: string[];
}

function playRoom(room: DungeonRoom, storage?: StorageLike): RoomOutcome {
  const hpStart = heroOrThrow().hp;
  useCombatStore.getState().startDungeonRoom({ room });
  const battle = battleOrThrow();
  expect(battlePlayer(battle)?.hp).toBe(hpStart);
  const enemies = enemyCount(battle);
  playBattle();
  expect(isVictory(battleOrThrow())).toBe(true);
  const combat = battlePool();
  const fallen = fallenIds();
  useCombatStore.getState().settleDungeonRoom({ storage, rng: rewardRng });
  expect(useCombatStore.getState().combat).toBeNull();
  const hero = heroOrThrow();
  return { hpStart, ...combat, hpEnd: hero.hp, maxHpEnd: hero.maxHp, enemies, fallen };
}

/** Pool du héros DANS la bataille : le coût du combat, avant tout soin. */
function battlePool(): { hpBattleEnd: number; maxHpBattle: number } {
  const pool = battlePlayer(battleOrThrow());
  if (pool === undefined) throw new Error("héros absent de la bataille");
  return { hpBattleEnd: pool.hp, maxHpBattle: pool.maxHp };
}

/** `attemptRoom` doit compter les occurrences : 2 Piou vaincus ⇒ l'id apparaît 2 fois. */
function assertOccurrences(room: DungeonRoom, fallen: readonly string[]): void {
  for (const group of roomMonsters(room)) {
    expect(fallen.filter((id) => id === group.monsterId)).toHaveLength(group.count);
  }
}

/** Kamas d'un monstre au tirage constant du walkthrough (`rewardRng = 0.35`). */
function kamasOf(monsterId: string): number {
  const monster = mustFind(monsters, monsterId);
  if (monster.kamasMin === undefined || monster.kamasMax === undefined) return 0;
  return monster.kamasMin + Math.floor(0.35 * (monster.kamasMax - monster.kamasMin + 1));
}

function roomInstances(room: DungeonRoom): MonsterDef[] {
  return roomMonsters(room).flatMap((group) =>
    Array.from({ length: group.count }, () => mustFind(monsters, group.monsterId)),
  );
}

/** Attendu COMBAT-09 : Σ des `baseXp`, `max(M)` pour l'écart et l'anti-farm. */
function roomXp(room: DungeonRoom): number {
  const defs = roomInstances(room);
  const baseMonsterXp = defs.reduce((total, monster) => total + monster.baseXp, 0);
  const monsterLevel = Math.max(...defs.map((monster) => monster.level));
  const { level, wisdom } = heroOrThrow();
  return computeCombatXp({ baseMonsterXp, playerLevel: level, monsterLevel, wisdom, ...progression.experience });
}

function roomKamas(room: DungeonRoom): number {
  return roomInstances(room).reduce((total, monster) => total + kamasOf(monster.id), 0);
}

interface Traversal {
  run: DungeonRunState | null;
  hpTrail: RoomOutcome[];
  enemyCounts: number[];
  xp: number;
  kamas: number;
}

// `attemptRoom` a désormais un appelant de production (5D-a) :
// `useCombatStore.attemptCurrentRoom` l'appelle depuis `settleDungeonRoom`, avec
// les IDs lus dans l'état de bataille. Ce walkthrough garde un pilotage direct du
// moteur pour vérifier `attemptRoom` seul (occurrences, refus partiel) ; le
// parcours câblé de bout en bout est couvert par `tests/unit/dungeonEntry.spec.ts`.
// Dette D71 : ces 4 salles restent infaisables au niveau 16 réel (l'équilibrage
// n'est pas prouvé ici, le walkthrough mesure le moteur, pas la viabilité).
function traverseDungeon(dungeon: DungeonDef, start: DungeonRunState): Traversal {
  const traversal: Traversal = { run: start, hpTrail: [], enemyCounts: [], xp: 0, kamas: 0 };
  for (const room of dungeon.rooms) {
    const expected = { xp: roomXp(room), kamas: roomKamas(room) };
    const before = useCombatStore.getState().dungeonRun;
    if (before === null) throw new Error(`run absent avant la salle ${room.roomNumber}`);
    const outcome = playRoom(room);
    assertAttemptRoom(dungeon, before, room, outcome.fallen);
    traversal.run = useCombatStore.getState().dungeonRun;
    traversal.hpTrail.push(outcome);
    traversal.enemyCounts.push(outcome.enemies);
    traversal.xp += expected.xp;
    traversal.kamas += expected.kamas;
  }
  return traversal;
}

/** `attemptRoom` seul : salle complète acceptée, un vaincu manquant refusé. */
function assertAttemptRoom(dungeon: DungeonDef, run: DungeonRunState, room: DungeonRoom, fallen: string[]): void {
  const attempt = attemptRoom({ run, dungeon, defeatedMonsterIds: fallen });
  expect(attempt.cleared).toBe(true);
  assertOccurrences(room, fallen);
  expect(attemptRoom({ run, dungeon, defeatedMonsterIds: fallen.slice(1) }).cleared).toBe(false);
}

/**
 * Le donjon COÛTE des PV : dans CHAQUE salle, le héros encaisse avant de gagner.
 * La mesure est prise dans la bataille (`hpBattleEnd`), donc le soin de
 * franchissement ne peut pas la masquer — c'est le coût du combat, pas du trajet.
 */
function assertEveryRoomCostsHp(trail: readonly RoomOutcome[]): void {
  for (const step of trail) {
    expect(step.hpBattleEnd).toBeLessThan(step.hpStart);
    expect(step.hpBattleEnd).toBeGreaterThan(0);
  }
}

/** Le soin entre salles ne dépasse jamais le plafond, ni celui du pool de combat. */
function assertHealCapped(trail: readonly RoomOutcome[]): void {
  for (const step of trail) {
    expect(step.hpEnd).toBeLessThanOrEqual(step.maxHpBattle);
    expect(step.hpEnd).toBeLessThanOrEqual(step.maxHpEnd);
    expect(step.hpEnd).toBeGreaterThan(0);
  }
}

/** Entrée de salle N+1 : jamais moins de PV que la sortie de la salle N. */
function assertCrossingMonotonic(trail: readonly RoomOutcome[]): void {
  for (const [index, step] of trail.entries()) {
    if (index === 0) continue;
    expect(step.hpStart).toBeGreaterThanOrEqual(trail[index - 1]?.hpEnd ?? 0);
  }
}

/**
 * DEC-03 : le soin de franchissement est un RATIO, jamais un retour au maximum.
 * Le cas d'école est une barre presque vide (10 %) : à `healBetweenRooms` 0,75
 * elle ressort entamée ; à 1, elle redeviendrait pleine et cette assertion
 * rougirait. C'est la preuve que le soin ne peut pas annuler le coût du donjon.
 * Les PV ci-dessous sont des entrées de fonction pure, pas des données de jeu.
 */
function assertCrossingHealIsPartial(): void {
  const ratio = dungeonOrThrow().healBetweenRooms;
  const maxHp = 100;
  const wounded = 10;
  const healed = healBetweenRooms({ hp: wounded, maxHp, ratio });
  expect(ratio).toBeLessThan(1);
  expect(healed.hp).toBeGreaterThan(wounded);
  expect(healed.hp).toBeLessThanOrEqual(maxHp);
  expect(healed.hp).toBeLessThan(maxHp);
}

function invariants() {
  const { combat, mode, exploration, selectedSpellId, activeGroup, rewards, mapId } = useCombatStore.getState();
  return { combat, mode, exploration, selectedSpellId, activeGroup, rewards, mapId };
}

function roomBattle(roomNumber: number): BattleState {
  const room = roomAt(roomNumber - 1);
  useCombatStore.getState().startDungeonRoom({ room });
  return battleOrThrow();
}

function roomAt(index: number): DungeonRoom {
  const room = dungeonOrThrow().rooms[index];
  if (room === undefined) throw new Error(`salle ${index + 1} absente`);
  return room;
}

function withSideHp(battle: BattleState, side: "player" | "enemy", hp: number): BattleState {
  const combatants = battle.combatants.map((entry) => (entry.side === side ? { ...entry, hp } : entry));
  return { ...battle, combatants };
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  useCombatStore.setState({
    battle: null,
    combat: null,
    mode: "exploration",
    exploration: null,
    activeGroup: null,
    selectedSpellId: null,
    hoveredCell: null,
    rewards: null,
  });
});

describe("walkthrough donjon de la Ferraille", () => {
  it("craft → entrée → 4 salles 1vN → victoire → XP, kamas et butin par salle", () => {
    prepareHero();
    expect(craftRealRecipe()).toBe(1);
    const before = invariants();
    stockKey();
    const { dungeon, run } = enterWithKey();
    const traversal = traverseDungeon(dungeon, run);
    expect(traversal.enemyCounts).toEqual([3, 4, 4, 4]);
    // Le héros n'est PAS invulnérable : chaque salle lui prend des PV. La mesure
    // est celle du combat (`hpBattleEnd < hpStart`), car avec `healBetweenRooms`
    // 0,75 les salles 1-3 se referment légitimement à pleine barre : exiger
    // `hero.hp < hero.maxHp` à la SORTIE de chaque salle serait faux et fragile.
    assertEveryRoomCostsHp(traversal.hpTrail);
    assertHealCapped(traversal.hpTrail);
    assertCrossingMonotonic(traversal.hpTrail);
    expect(traversal.run).toBeNull();
    const hero = heroOrThrow();
    // Chaque salle crédite via `resolveRoomRewards` (mêmes formules 1.29 que
    // le 1v1, agrégat Σ des `baseXp` / `max(M)`). Le héros monte au fil des
    // salles : 295 + 365 + 511 + 575 = 1746 XP, niveaux 1 → 3 → 3 → 4.
    expect(traversal.xp).toBe(1746);
    expect(traversal.kamas).toBe(359);
    expect(hero.level).toBe(4);
    expect(hero.xp).toBe(1746);
    expect(hero.kamas).toBe(359);
    expect(countItem(useGameStore.getState().inventory, "plume_mazoutee")).toBe(2);
    expect(countItem(useGameStore.getState().inventory, "fer_goutte_mazout")).toBe(4);
    expect(countItem(useGameStore.getState().inventory, "fer_pince_de_douze")).toBe(4);
    expect(countItem(useGameStore.getState().inventory, KEY_ID)).toBe(6);
    // Assertion restaurée de #41, perdue par #157 : la DERNIÈRE salle ne rend
    // aucun PV (pas de franchissement après elle), donc le héros finit entamé.
    expect(hero.hp).toBeGreaterThan(0);
    expect(hero.hp).toBeLessThan(hero.maxHp);
    expect(invariants()).toEqual(before);
    expect(useCombatStore.getState().battle).toBeNull();
    expect(useCombatStore.getState().dungeonNotice).toContain("Donjon terminé");
  });

  it("DEC-03 — le soin entre salles reste partiel, il ne rembourse pas le donjon", () => {
    prepareHero();
    assertCrossingHealIsPartial();
  });
});

/**
 * SPELL-04 : en salle, le sort armé est celui qui part. Le héros est mis au
 * contact (placement de salle non déterministe) et ouvre le tour ; le reste est
 * le vrai chemin (`selectSpell` → `battleSpellAttack`).
 */
describe("SPELL-04 — en salle, le joueur choisit son sort", () => {
  it("Épée du Destin part à la place de Pression : 4 PA et son nom au journal", () => {
    prepareHero();
    stockKey();
    enterWithKey();
    const battle = battleOrThrow();
    const hero = battlePlayer(battle);
    const enemy = livingOf(battle, "enemy")[0];
    if (hero === undefined || enemy === undefined) throw new Error("salle incomplète");
    const contact = { ...enemy, position: { x: hero.position.x + 1, y: hero.position.y } };
    const combatants = battle.combatants.map((entry) => (entry.id === enemy.id ? contact : entry));
    const activeIndex = battle.order.indexOf(hero.id);
    useCombatStore.setState({ battle: { ...battle, combatants, activeIndex } });
    useCombatStore.getState().selectSpell("epee_du_destin");
    expect(useCombatStore.getState().selectedSpellId).toBe("epee_du_destin");
    useCombatStore.getState().battleSpellAttack({ targetId: enemy.id, rng: () => 0 });
    const after = battleOrThrow();
    const player = battlePlayer(after);
    if (player === undefined) throw new Error("héros absent après le sort");
    expect(hero.ap - player.ap).toBe(4);
    expect(after.log.at(-1)).toContain("Épée du Destin");
    expect(after.combatants.find((entry) => entry.id === enemy.id)?.hp).toBeLessThan(enemy.hp);
  });
});

describe("rechargement entre deux salles", () => {
  it("ne rend pas les PV : héros blessé restauré, salle 2 au même niveau", () => {
    prepareHero();
    const storage = new MemoryStorage();
    useGameStore.getState().saveGame(storage);
    const first = playRoom(roomAt(0), storage);
    const wounded = first.hpEnd;
    expect(wounded).toBeLessThan(heroOrThrow().maxHp);
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    expect(heroOrThrow().hp).toBe(wounded);
    expect(heroOrThrow().hp).toBeLessThan(heroOrThrow().maxHp);
    const second = playRoom(roomAt(1), storage);
    expect(second.hpStart).toBe(wounded);
  });
});

describe("settleDungeonRoom — garde et sauvegarde", () => {
  it("refuse une défaite : PV intacts, aucune sauvegarde", () => {
    prepareHero();
    const storage = new MemoryStorage();
    const battle = withSideHp(roomBattle(1), "player", 0);
    useCombatStore.setState({ battle });
    const beforeHp = heroOrThrow().hp;
    useCombatStore.getState().settleDungeonRoom({ storage });
    expect(useCombatStore.getState().battle).toBe(battle);
    expect(heroOrThrow().hp).toBe(beforeHp);
    expect(storage.getItem(useGameStore.getState().saveKey)).toBeNull();
  });

  it("reporte les PV d'une victoire et les sauvegarde", () => {
    prepareHero();
    const storage = new MemoryStorage();
    const won = withSideHp(withSideHp(roomBattle(1), "player", 33), "enemy", 0);
    useCombatStore.setState({ battle: won });
    useCombatStore.getState().settleDungeonRoom({ storage });
    expect(heroOrThrow().hp).toBe(33);
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    expect(heroOrThrow().hp).toBe(33);
  });
});

describe("palier 15 — niveau moteur", () => {
  it("61 000 XP donnent le niveau 15 et ses PA de contrat", () => {
    const hero = createHero("Test", iop());
    const options = { amount: 61_000, tiers: progression.xpThresholds, apRules: progression.apRules };
    const { hero: gained } = gainXp({ hero, ...options, gainRules: progression.gainRules });
    expect(gained.level).toBe(15);
    expect(gained.ap).toBe(getBaseApForLevel(15, progression.apRules));
    expect(gained.xp).toBe(61_000);
    expect(gained.capitalPoints).toBe(progression.gainRules.capitalPoints * 14);
    expect(gained.maxHp).toBe(hero.maxHp + progression.gainRules.hp * 14);
  });
});
