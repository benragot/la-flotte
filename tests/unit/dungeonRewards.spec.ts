import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Hero } from "../../src/engine/createHero";
import { computeCombatXp } from "../../src/engine/economy";
import { addItem, countItem } from "../../src/engine/inventory";
import type { BattleState } from "../../src/engine/multiCombat";
import { isVictory } from "../../src/engine/multiCombat";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { DungeonDef, DungeonRoomDef } from "../../src/schemas/dungeonSchema";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import type { MonsterDef } from "../../src/schemas/monsterSchema";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";
import { useGameStore } from "../../src/store/useGameStore";
import { useCombatStore } from "../../src/store/useCombatStore";

/**
 * DATA-01 / DATA-02 — une salle de donjon nettoyée crédite XP, butin ET kamas
 * au héros persistant, par le même `resolveCombatRewards` que le 1v1. Le
 * tirage est injecté (`rng`) et l'attendu est relu dans `data/*.yaml`.
 */

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const DUNGEON: DungeonDef = first(parseDungeonsYaml(read("dungeons.yaml")), "donjon");
const MONSTERS = parseMonstersYaml(read("monsters.yaml"));
const PROGRESSION = parseProgressionYaml(read("progression.yaml"));
const ITEMS = parseItemsYaml(read("items.yaml"));

/** RNG constant : tous les tirages (drops + kamas) deviennent calculables. */
const ROLL = 0.5;
const rng = () => ROLL;

function first<T>(list: readonly T[], label: string): T {
  const value = list[0];
  if (value === undefined) throw new Error(`data/ ne déclare aucun ${label}`);
  return value;
}

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
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

function startingHatId(): string {
  const hats = ITEMS.filter((item) => item.category === "equipment" && item.starting === true && item.slot === "hat");
  const hat = hats[0];
  if (hat === undefined) throw new Error("aucun chapeau de départ dans data/items.yaml");
  return hat.id;
}

function prepareHero(): void {
  useGameStore.getState().createCharacter({ name: "Anselme", classId: "iop" });
  useGameStore.getState().equip({ itemId: startingHatId() });
}

function enterDungeon(): void {
  prepareHero();
  const { inventory } = useGameStore.getState();
  useGameStore.setState({ inventory: addItem({ inventory, itemId: DUNGEON.keyItemId, quantity: 1 }) });
  expect(useCombatStore.getState().enterDungeonRun({ dungeonId: DUNGEON.id })).toBe(true);
}

/** Salle courante gagnée d'un coup, lue dans l'état de bataille réel. */
function winCurrentRoom(): BattleState {
  const state = battleOrThrow();
  const combatants = state.combatants.map((entry) => ({ ...entry, hp: entry.side === "player" ? 10 : 0 }));
  const won = { ...state, combatants };
  useCombatStore.setState({ battle: won });
  expect(isVictory(won)).toBe(true);
  return won;
}

function monsterOf(monsterId: string): MonsterDef {
  return mustFind(MONSTERS, monsterId);
}

function roomMonsterIds(room: DungeonRoomDef): string[] {
  return room.monsters.flatMap((group) => Array.from({ length: group.count }, () => group.monsterId));
}

/** Tirage entier readonly du YAML : même convention que le code de production. */
function kamasOf(monster: MonsterDef): number {
  if (monster.kamasMin === undefined || monster.kamasMax === undefined) return 0;
  const span = monster.kamasMax - monster.kamasMin + 1;
  return monster.kamasMin + Math.floor(ROLL * span);
}

function expectedKamas(room: DungeonRoomDef): number {
  return roomMonsterIds(room).reduce((total, monsterId) => total + kamasOf(monsterOf(monsterId)), 0);
}

/**
 * Agrégat COMBAT-09 : Σ des `baseXp`, `max(M)` pour le niveau du plus gros
 * monstre (facteur d'écart et anti-farm).
 */
function expectedXp(room: DungeonRoomDef): number {
  const monsters = roomMonsterIds(room).map(monsterOf);
  const baseMonsterXp = monsters.reduce((total, monster) => total + monster.baseXp, 0);
  const monsterLevel = Math.max(...monsters.map((monster) => monster.level));
  const { level, wisdom } = heroOrThrow();
  const input = { baseMonsterXp, playerLevel: level, monsterLevel, wisdom, ...PROGRESSION.experience };
  return computeCombatXp(input);
}

function inventorySnapshot(): Record<string, number> {
  const { inventory } = useGameStore.getState();
  return inventory.stacks.reduce<Record<string, number>>((all, entry) => {
    all[entry.itemId] = countItem(inventory, entry.itemId);
    return all;
  }, {});
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

describe("DATA-01/DATA-02 — récompenses d'une salle nettoyée", () => {
  it("crédite l'XP et les kamas de la salle au héros persistant", () => {
    enterDungeon();
    const room = DUNGEON.rooms[0];
    if (room === undefined) throw new Error("donjon sans salle");
    const xp = expectedXp(room);
    const kamas = expectedKamas(room);
    winCurrentRoom();
    useCombatStore.getState().settleDungeonRoom({ rng });
    expect(heroOrThrow().xp).toBe(xp);
    expect(heroOrThrow().kamas).toBe(kamas);
    expect(kamas).toBeGreaterThan(0);
    const notice = useCombatStore.getState().dungeonNotice ?? "";
    expect(notice).toContain(`${xp} XP`);
    expect(notice).toContain(`${kamas} kamas`);
  });

  it("ne crédite qu'une seule fois : un second règlement ne rajoute rien", () => {
    enterDungeon();
    winCurrentRoom();
    useCombatStore.getState().settleDungeonRoom({ rng });
    const once = { xp: heroOrThrow().xp, kamas: heroOrThrow().kamas, inventory: inventorySnapshot() };
    useCombatStore.getState().settleDungeonRoom({ rng });
    expect(heroOrThrow().xp).toBe(once.xp);
    expect(heroOrThrow().kamas).toBe(once.kamas);
    expect(inventorySnapshot()).toEqual(once.inventory);
  });
});

describe("DATA-01/DATA-02 — bornes et dernière salle", () => {
  it("ne crédite rien tant que la salle n'est pas gagnée", () => {
    enterDungeon();
    useCombatStore.getState().settleDungeonRoom({ rng });
    expect(heroOrThrow().xp).toBe(0);
    expect(heroOrThrow().kamas).toBe(0);
  });

  it("crédite la dernière salle comme les autres, puis ferme le donjon", () => {
    enterDungeon();
    let expected = 0;
    for (const room of DUNGEON.rooms) {
      expected += expectedKamas(room);
      winCurrentRoom();
      useCombatStore.getState().settleDungeonRoom({ rng });
    }
    expect(useCombatStore.getState().dungeonRun).toBeNull();
    expect(heroOrThrow().kamas).toBe(expected);
    expect(useCombatStore.getState().dungeonNotice).toContain("Donjon terminé");
  });
});
