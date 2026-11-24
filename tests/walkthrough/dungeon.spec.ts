import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createHero } from "../../src/engine/createHero";
import type { Hero } from "../../src/engine/createHero";
import { attemptRoom, enterDungeon, isDungeonComplete, roomMonsters } from "../../src/engine/dungeon";
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
const HERO_ATTACK: AttackSpec = { base: 400, element: "earth", baseCrit: 0, apCost: 1 };
const ENEMY_ATTACK = { base: 1, element: "neutral" as const, baseCrit: 0 };
/** Aléa injecté dans le store : crit et drops jamais tirés par `Math.random`. */
const rng: Rng = () => 0.5;

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

function enterWithKey(): { dungeon: DungeonDef; run: DungeonRunState } {
  const dungeon = dungeonOrThrow();
  const result = enterDungeon({ dungeon, inventory: useGameStore.getState().inventory });
  if (result.run === null) throw new Error(`entrée refusée : ${result.reason ?? "raison inconnue"}`);
  expect(result.reason).toBeNull();
  expect(result.run.keysConsumed).toBe(1);
  expect(countItem(result.inventory, KEY_ID)).toBe(0);
  useGameStore.setState({ inventory: result.inventory });
  return { dungeon, run: result.run };
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
  hpStart: number;
  hpEnd: number;
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
  const fallen = fallenIds();
  useCombatStore.getState().settleDungeonRoom({ storage });
  expect(useCombatStore.getState().battle).toBeNull();
  expect(useCombatStore.getState().combat).toBeNull();
  return { hpStart, hpEnd: heroOrThrow().hp, enemies, fallen };
}

/** `attemptRoom` doit compter les occurrences : 2 Piou vaincus ⇒ l'id apparaît 2 fois. */
function assertOccurrences(room: DungeonRoom, fallen: readonly string[]): void {
  for (const group of roomMonsters(room)) {
    expect(fallen.filter((id) => id === group.monsterId)).toHaveLength(group.count);
  }
}

function monsterXp(monsterId: string): number {
  const monster: MonsterDef = mustFind(monsters, monsterId);
  const { level, wisdom } = heroOrThrow();
  const input = {
    baseMonsterXp: monster.baseXp,
    playerLevel: level,
    monsterLevel: monster.level,
    wisdom,
    ...progression.experience,
  };
  return computeCombatXp(input);
}

function roomXp(room: DungeonRoom): number {
  return roomMonsters(room).reduce((total, group) => total + monsterXp(group.monsterId) * group.count, 0);
}

interface Traversal {
  run: DungeonRunState;
  hpTrail: RoomOutcome[];
  enemyCounts: number[];
  xp: number;
}

// `attemptRoom` a désormais un appelant de production (5D-a) :
// `useCombatStore.attemptCurrentRoom` l'appelle depuis `settleDungeonRoom`, avec
// les IDs lus dans l'état de bataille. Ce walkthrough garde un pilotage direct du
// moteur pour vérifier `attemptRoom` seul (occurrences, refus partiel) ; le
// parcours câblé de bout en bout est couvert par `tests/unit/dungeonEntry.spec.ts`.
// Dette D71 : ces 4 salles restent infaisables au niveau 16 réel (l'équilibrage
// n'est pas prouvé ici, le walkthrough mesure le moteur, pas la viabilité).
function traverseDungeon(dungeon: DungeonDef, start: DungeonRunState): Traversal {
  const traversal: Traversal = { run: start, hpTrail: [], enemyCounts: [], xp: 0 };
  for (const room of dungeon.rooms) {
    const outcome = playRoom(room);
    const defeatedMonsterIds = outcome.fallen;
    const attempt = attemptRoom({ run: traversal.run, dungeon, defeatedMonsterIds });
    expect(attempt.cleared).toBe(true);
    assertOccurrences(room, defeatedMonsterIds);
    const truncated = attemptRoom({ run: traversal.run, dungeon, defeatedMonsterIds: defeatedMonsterIds.slice(1) });
    expect(truncated.cleared).toBe(false);
    traversal.run = attempt.run;
    traversal.hpTrail.push(outcome);
    traversal.enemyCounts.push(outcome.enemies);
    traversal.xp += roomXp(room);
  }
  return traversal;
}

function assertNoHeal(trail: readonly RoomOutcome[]): void {
  for (const [index, step] of trail.entries()) {
    expect(step.hpEnd).toBeLessThanOrEqual(step.hpStart);
    if (index > 0) expect(step.hpStart).toBe(trail[index - 1]?.hpEnd);
  }
}

// Le `rewards` ci-dessous est CONSTRUIT À LA MAIN : ce chemin ne traverse PAS
// `resolveCombatRewards` (donc ni prospection, ni drops, ni `levelUp`).
// Seul le crédit via `gainXp` (dans `creditCombatRewards`) est prouvé ici.
function creditXp(amount: number): void {
  const hero = heroOrThrow();
  const totalXp = hero.xp + amount;
  const rewards = { xpGained: amount, totalXp, level: hero.level, levelUp: null, prospection: hero.pp, drops: [] };
  useGameStore.getState().creditCombatRewards(rewards);
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
  it("craft → entrée → 4 salles 1vN → victoire → XP", () => {
    prepareHero();
    expect(craftRealRecipe()).toBe(1);
    const before = invariants();
    stockKey();
    const { dungeon, run } = enterWithKey();
    const traversal = traverseDungeon(dungeon, run);
    expect(traversal.enemyCounts).toEqual([3, 4, 4, 4]);
    assertNoHeal(traversal.hpTrail);
    expect(isDungeonComplete(traversal.run, dungeon)).toBe(true);
    creditXp(traversal.xp);
    const hero = heroOrThrow();
    // XP CALCULÉE depuis les `baseXp` du YAML (via `computeCombatXp`),
    // mais CRÉDITÉE via un `rewards` fabriqué à la main (cf. `creditXp`).
    // Ce n'est donc pas `resolveCombatRewards` qui est exercé.
    // Depuis le rendement décroissant 1.29, le héros niveau 16 ne touche plus
    // l'XP pleine des monstres 1 à 15 : 2135 → 1736 (écart de niveau + anti-farm).
    expect(traversal.xp).toBe(1736);
    expect(hero.level).toBe(4);
    expect(hero.xp).toBe(1736);
    expect(hero.hp).toBeGreaterThan(0);
    expect(hero.hp).toBeLessThan(hero.maxHp);
    expect(invariants()).toEqual(before);
    expect(useCombatStore.getState().battle).toBeNull();
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
