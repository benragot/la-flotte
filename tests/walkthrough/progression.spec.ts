import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { castSpell } from "../../src/engine/combatLoop/cast";
import { getCastableCells } from "../../src/engine/combatLoop/castable";
import { getReachableCells } from "../../src/engine/combatLoop/cells";
import { initCombat } from "../../src/engine/combatLoop/init";
import { moveActiveEntity } from "../../src/engine/combatLoop/move";
import { resolveCombatRewards } from "../../src/engine/combatLoop/rewards";
import { endPlayerTurn } from "../../src/engine/combatLoop/turn";
import type { CombatState, Rng } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import type { Hero } from "../../src/engine/createHero";
import { totalStatsFor } from "../../src/engine/hero/totalStats";
import { addItem, countItem, getActiveSetBonuses } from "../../src/engine/inventory";
import type { InventoryState } from "../../src/engine/inventory";
import type { StorageLike } from "../../src/engine/save";
import { parseAsciiMap, samePosition } from "../../src/engine/grid";
import { findPath } from "../../src/engine/grid";
import type { Position } from "../../src/engine/grid";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";
import { parseSetsYaml } from "../../src/schemas/setSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { useGameStore } from "../../src/store/useGameStore";

const CLASSES_PATH = join(process.cwd(), "data", "classes.yaml");
const loadIop = () => {
  const classes = parseClassesYaml(readFileSync(CLASSES_PATH, "utf8"));
  return classes.find((entry) => entry.id === "iop");
};

const MAX_TURNS = 40;
const DEMO_MAP_ID = "ferraille_plage_01";
const DEMO_MONSTER_ID = "piou_mazoute";
const PLAYER_SPELL_ID = "pression";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");

function findById<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

const loadCombatData = () => ({
  map: parseAsciiMap(findById(parseMapsYaml(read("maps.yaml")), DEMO_MAP_ID).grid),
  monster: findById(parseMonstersYaml(read("monsters.yaml")), DEMO_MONSTER_ID),
  spells: parseSpellsYaml(read("spells.yaml")),
  progression: parseProgressionYaml(read("progression.yaml")),
});

/** Longueur du plus court chemin vers le monstre, murs contournés. */
function routeLength(state: CombatState, cell: Position): number {
  const map = state.map;
  const path = findPath({ map, from: cell, to: state.enemy.position, maxPm: map.width * map.height });
  return path === null ? Number.POSITIVE_INFINITY : path.length;
}

const closest = (state: CombatState) => (best: Position | null, cell: Position) =>
  best === null || routeLength(state, cell) < routeLength(state, best) ? cell : best;

function attackOnce(state: CombatState, rng: Rng): CombatState {
  const target = state.enemy.position;
  const inRange = getCastableCells(state, PLAYER_SPELL_ID).some((cell) => samePosition(cell, target));
  if (!inRange) return state;
  return castSpell({ state, spellId: PLAYER_SPELL_ID, target, rng });
}

function castAll(state: CombatState, rng: Rng): CombatState {
  let current = state;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const next = attackOnce(current, rng);
    if (next === current) return current;
    current = next;
  }
  return current;
}

function stepCloser(state: CombatState): CombatState {
  const reach = routeLength(state, state.player.position);
  const better = getReachableCells(state).filter((cell) => routeLength(state, cell) < reach);
  const best = better.reduce<Position | null>(closest(state), null);
  return best === null ? state : moveActiveEntity(state, best);
}

const playTurn = (state: CombatState, rng: Rng): CombatState => castAll(stepCloser(state), rng);

function runScenario(state: CombatState, rng: Rng): CombatState {
  let current = state;
  for (let turn = 0; turn < MAX_TURNS && current.phase !== "victory" && current.phase !== "defeat"; turn += 1) {
    current = playTurn(current, rng);
    if (current.phase === "victory") break;
    current = endPlayerTurn(current, rng);
  }
  return current;
}

function startScenario(): { state: CombatState; hero: Hero; data: ReturnType<typeof loadCombatData> } {
  const iop = loadIop();
  if (iop === undefined) throw new Error("Classe iop absente de classes.yaml");
  const data = loadCombatData();
  const hero = createHero("Balthazar", iop);
  return { state: initCombat({ map: data.map, hero, monster: data.monster, spells: data.spells }), hero, data };
}

describe("walkthrough : progression", () => {
  it("charge classes.yaml et trouve la classe Iop", () => {
    expect(loadIop()).toBeDefined();
  });

  it("crée un personnage Iop niveau 1 avec ses stats de départ", () => {
    const iop = loadIop();
    if (!iop) throw new Error("Classe iop absente de classes.yaml");
    const hero = createHero("Balthazar", iop);
    expect(hero.level).toBe(1);
    expect(hero.ap).toBe(6);
    expect(hero.mp).toBe(3);
    expect(hero.hp).toBe(50);
    expect(hero.pp).toBe(100);
  });

  it("joue un combat complet jusqu'à la victoire et la montée de niveau", () => {
    const { state, data } = startScenario();
    const final = runScenario(state, () => 0.5);
    expect(final.turn).toBeLessThanOrEqual(MAX_TURNS);
    expect(final.phase).toBe("victory");
    const rewards = resolveCombatRewards({
      heroXp: 0,
      hero: final.player,
      monster: data.monster,
      progression: data.progression,
      rng: () => 0,
    });
    expect(rewards.xpGained).toBe(120);
    expect(rewards.level).toBe(2);
    expect(rewards.levelUp).toEqual({ hp: 5, capitalPoints: 5, spellPoints: 1 });
    expect(rewards.drops).toEqual(["plume_mazoutee"]);
  });
});

const MAX_COMBATS = 60;
const CAMPAIGN_HERO = { name: "Anselme", classId: "iop" };
const SET_PIECES = [
  "chapeau_piou_mazoute",
  "cape_graisseuse",
  "amulette_de_la_coupure",
  "bottes_de_fond_de_cale",
  "gourdin_du_matelot",
];
const FIGHT_RNG = () => 0.5;
const DROP_RNG = () => 0;

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

let combatsPlayed = 0;

function heroState(): Hero {
  const { hero } = useGameStore.getState();
  if (hero === null) throw new Error("héros persistant absent");
  return hero;
}

function fightToVictory(hero: Hero): CombatState {
  const data = loadCombatData();
  const start = initCombat({ map: data.map, hero, monster: data.monster, spells: data.spells });
  const final = runScenario(start, FIGHT_RNG);
  if (final.phase !== "victory") throw new Error(`combat non gagné au tour ${final.turn}`);
  return final;
}

function creditVictory(state: CombatState): void {
  const data = loadCombatData();
  const options = { hero: state.player, monster: data.monster, progression: data.progression };
  const rewards = resolveCombatRewards({ ...options, heroXp: heroState().xp, rng: DROP_RNG });
  useGameStore.getState().creditCombatRewards(rewards);
}

function farmToLevelFive(): number {
  let combats = 0;
  while (heroState().level < 5 && combats < MAX_COMBATS) {
    creditVictory(fightToVictory(heroState()));
    combats += 1;
  }
  return combats;
}

function gearUp(): void {
  SET_PIECES.forEach((itemId) => addToBag(itemId));
  SET_PIECES.forEach((itemId) => useGameStore.getState().equip({ itemId }));
}

function addToBag(itemId: string): void {
  useGameStore.setState((state) => ({
    inventory: addItem({ inventory: state.inventory, itemId, quantity: 1 }),
  }));
}

function loadCatalogue() {
  return {
    items: parseItemsYaml(read("items.yaml")),
    sets: parseSetsYaml(read("sets.yaml")),
  };
}

function equippedInventory(): InventoryState {
  return useGameStore.getState().inventory;
}

function activeSetReport() {
  const { items, sets } = loadCatalogue();
  const inventory = equippedInventory();
  return { inventory, items, sets, bonuses: getActiveSetBonuses({ inventory, items, sets }) };
}

beforeAll(() => {
  useGameStore.getState().resetGame();
  useGameStore.getState().createCharacter(CAMPAIGN_HERO);
  combatsPlayed = farmToLevelFive();
});

describe("walkthrough : boucle de farm déterministe", () => {
  it("atteint le niveau 5 en moins de 60 combats réels", () => {
    const hero = heroState();
    expect(combatsPlayed).toBeLessThanOrEqual(MAX_COMBATS);
    expect(combatsPlayed).toBe(24);
    expect(hero.level).toBe(5);
    expect(hero.xp).toBeGreaterThanOrEqual(2800);
    expect(hero.xp).toBe(2880);
  });

  it("investit les points de capital gagnés dans la Force de l'Iop", () => {
    expect(heroState().capitalPoints).toBe(20);
    useGameStore.getState().allocateStat({ stat: "strength", points: 20 });
    expect(heroState().strength).toBe(20);
    expect(heroState().capitalPoints).toBe(0);
  });

  it("fait payer 1 puis 2 points au franchissement 99 → 100 → 101", () => {
    useGameStore.setState({ hero: { ...heroState(), strength: 99, capitalPoints: 3 } });
    useGameStore.getState().allocateStat({ stat: "strength", points: 1 });
    expect(heroState().strength).toBe(100);
    expect(heroState().capitalPoints).toBe(2);
    useGameStore.getState().allocateStat({ stat: "strength", points: 2 });
    expect(heroState().strength).toBe(101);
    expect(heroState().capitalPoints).toBe(0);
  });
});

describe("walkthrough : équipement, soin et sauvegarde", () => {
  it("équipe les 5 pièces et active les 3 paliers de la panoplie", () => {
    gearUp();
    const hero = heroState();
    const { inventory, items, sets, bonuses } = activeSetReport();
    expect(bonuses.map((entry) => entry.activePieces)).toEqual([4]);
    expect(bonuses[0]?.bonuses.length).toBe(3);
    const stats = totalStatsFor({ hero, inventory, items, sets });
    expect(stats.ap).toBe(1);
    expect(stats.strength).toBe(hero.strength + 13);
    expect(stats.vitality).toBe(hero.vitality + 23 + 20);
  });

  it("soigne un héros blessé sans dépasser ses PV maximum", () => {
    const hero = heroState();
    useGameStore.setState({ hero: { ...hero, hp: hero.maxHp - 12 } });
    addToBag("soupe_de_baleine_tiede");
    useGameStore.getState().drinkConsumable({ itemId: "soupe_de_baleine_tiede" });
    expect(heroState().hp).toBe(hero.maxHp);
    expect(countItem(equippedInventory(), "soupe_de_baleine_tiede")).toBe(0);
  });

  it("sauvegarde puis recharge héros, sac, équipement et drapeaux à l'identique", () => {
    const storage = new MemoryStorage();
    useGameStore.setState({ flags: { niveau_cinq_atteint: true } });
    expect(useGameStore.getState().saveGame(storage)).toBe(true);
    const before = useGameStore.getState();
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().hero).toBeNull();
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    const after = useGameStore.getState();
    expect(after.hero).toEqual(before.hero);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.flags).toEqual(before.flags);
  });
});
