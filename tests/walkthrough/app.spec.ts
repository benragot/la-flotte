import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getReachableCells } from "../../src/engine/combatLoop/cells";
import { getCastableCells } from "../../src/engine/combatLoop/castable";
import type { CombatState } from "../../src/engine/combatLoop/types";
import { getMonsterGroupAt } from "../../src/engine/exploration";
import type { ExplorationState } from "../../src/engine/exploration";
import { findPath, samePosition } from "../../src/engine/grid";
import type { Position } from "../../src/engine/grid";
import { totalStatsFor } from "../../src/engine/hero/totalStats";
import { countItem } from "../../src/engine/inventory";
import type { StorageLike } from "../../src/engine/save";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import { parseSetsYaml } from "../../src/schemas/setSchema";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";
import { appScreen } from "../../src/ui/appRouting";

const HERO = { name: "Anselme", classId: "iop" };
const PLAYER_SPELL_ID = "pression";
const FREE_CELL = { x: 4, y: 3 };
const GROUP_CELL = { x: 5, y: 9 };
const MAX_TURNS = 40;
const FIXED_RNG = () => 0;
const APP_PATH = "src/ui/App.tsx";

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

function readData(file: string) {
  return readFileSync(join(process.cwd(), "data", file), "utf8");
}

function storeCombat(): CombatState {
  const { combat } = useCombatStore.getState();
  if (combat === null) throw new Error("combat attendu dans le store");
  return combat;
}

function storeExploration(): ExplorationState {
  const { exploration } = useCombatStore.getState();
  if (exploration === null) throw new Error("exploration attendue dans le store");
  return exploration;
}

function routeLength(combat: CombatState, cell: Position): number {
  const { map } = combat;
  const path = findPath({ map, from: cell, to: combat.enemy.position, maxPm: map.width * map.height });
  return path === null ? Number.POSITIVE_INFINITY : path.length;
}

const closestToEnemy = (combat: CombatState) => (best: Position | null, cell: Position) =>
  best === null || routeLength(combat, cell) < routeLength(combat, best) ? cell : best;

function closerCell(combat: CombatState): Position | null {
  const reach = routeLength(combat, combat.player.position);
  const better = getReachableCells(combat).filter((cell) => routeLength(combat, cell) < reach);
  return better.reduce<Position | null>(closestToEnemy(combat), null);
}

function inRange(combat: CombatState): boolean {
  const target = combat.enemy.position;
  return getCastableCells(combat, PLAYER_SPELL_ID).some((cell) => samePosition(cell, target));
}

function attackOrApproach(): void {
  const store = useCombatStore.getState();
  const combat = storeCombat();
  const shoot = inRange(combat);
  const target = shoot ? combat.enemy.position : closerCell(combat);
  store.selectSpell(shoot ? PLAYER_SPELL_ID : null);
  if (target !== null) store.clickCell(target);
}

function playTurn(): void {
  if (!inRange(storeCombat())) return attackOrApproach();
  for (let shot = 0; shot < 6; shot += 1) {
    const combat = storeCombat();
    if (combat.phase !== "player_turn" || !inRange(combat)) return;
    attackOrApproach();
    if (storeCombat() === combat) return;
  }
}

function playToVictory(): CombatState {
  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    const combat = storeCombat();
    if (combat.phase === "victory") return combat;
    playTurn();
    useCombatStore.getState().endTurn();
  }
  throw new Error("victoire non atteinte dans la borne dure");
}

function catalogue() {
  return {
    items: parseItemsYaml(readData("items.yaml")),
    sets: parseSetsYaml(readData("sets.yaml")),
  };
}

function heroOrThrow() {
  const { hero } = useGameStore.getState();
  if (hero === null) throw new Error("héros persistant absent");
  return hero;
}

function totalStrength(): number {
  return totalStatsFor({ hero: heroOrThrow(), inventory: useGameStore.getState().inventory, ...catalogue() }).strength;
}

const storage = new MemoryStorage();

beforeEach(() => {
  vi.spyOn(Math, "random").mockImplementation(FIXED_RNG);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("assemblage : création, exploration et combat", () => {
  it("démarre sur l'écran de création quand le stockage est vide", () => {
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().loadGame(storage)).toBe(false);
    const { hero } = useGameStore.getState();
    expect(hero).toBeNull();
    expect(appScreen(hero !== null)).toBe("creation");
  });

  it("crée le personnage puis entre en exploration avec un groupe", () => {
    useGameStore.getState().createCharacter(HERO);
    useCombatStore.getState().startExploration();
    const { hero } = useGameStore.getState();
    const { mode, exploration } = useCombatStore.getState();
    expect(appScreen(hero !== null)).toBe("arena");
    expect(mode).toBe("exploration");
    expect(exploration?.monsterGroups).toHaveLength(1);
  });

  it("déplace le héros sur une case vide, engage le groupe et remporte le combat", () => {
    useCombatStore.getState().clickCell(FREE_CELL);
    expect(storeExploration().playerPos).toEqual(FREE_CELL);
    expect(getMonsterGroupAt(storeExploration(), GROUP_CELL)).not.toBeNull();
    useCombatStore.getState().clickCell(GROUP_CELL);
    expect(useCombatStore.getState().mode).toBe("combat");
    expect(playToVictory().phase).toBe("victory");
  });

  it("revient sur la carte avec le groupe respawné", () => {
    useCombatStore.getState().returnToMap();
    const { mode, combat, exploration, rewards } = useCombatStore.getState();
    expect(mode).toBe("exploration");
    expect(combat).toBeNull();
    expect(rewards).toBeNull();
    expect(exploration?.monsterGroups).toHaveLength(1);
  });
});

describe("assemblage : équipement et sauvegarde", () => {
  it("équipe le gourdin du kit de départ depuis le sac et les stats changent", () => {
    const before = totalStrength();
    expect(countItem(useGameStore.getState().inventory, "gourdin_du_matelot")).toBe(1);
    useGameStore.getState().equip({ itemId: "gourdin_du_matelot" });
    const { inventory } = useGameStore.getState();
    expect(inventory.equipment.weapon).toBe("gourdin_du_matelot");
    expect(countItem(inventory, "gourdin_du_matelot")).toBe(0);
    expect(totalStrength()).toBeGreaterThan(before);
  });

  it("recharge héros, niveau, inventaire et équipement à l'identique", () => {
    const before = useGameStore.getState();
    expect(before.saveGame(storage)).toBe(true);
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().hero).toBeNull();
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    const after = useGameStore.getState();
    expect(after.hero).toEqual(before.hero);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.hero?.level).toBe(before.hero?.level);
  });
});

describe("assemblage : source de App", () => {
  it("porte le nom accessible de l'arène sur un main, pas sur un div", () => {
    const source = readFileSync(join(process.cwd(), APP_PATH), "utf8");
    expect(source).toMatch(/<main[^>]*aria-label="Terrain de combat"/);
    expect(source).not.toMatch(/<div[^>]*aria-label=/);
  });

  it("garde le HUD dans le flux sous l'arène : 240 px en combat, épousé en exploration", () => {
    const source = readFileSync(join(process.cwd(), APP_PATH), "utf8");
    expect(source).toMatch(/h-\[240px\][^"]*shrink-0/);
    expect(source).toContain("min-h-0 flex-1");
  });
});
