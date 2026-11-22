import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Hero } from "../../src/engine/createHero";
import { createHero } from "../../src/engine/createHero";
import { combatantFromHero, gainXp, spendCapitalPoints } from "../../src/engine/hero";
import { totalStatsFor } from "../../src/engine/hero/totalStats";
import { addItem, equipItem } from "../../src/engine/inventory";
import type { InventoryState } from "../../src/engine/inventory";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import type { StorageLike } from "../../src/engine/save";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { ClassDef } from "../../src/schemas/classSchema";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { ItemDef } from "../../src/schemas/itemSchema";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";
import { parseSetsYaml } from "../../src/schemas/setSchema";
import { emptyInventory } from "../../src/store/gameSelectors";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";

/**
 * D45 — fidélité 1.29 : **1 point de Vitalité = +1 PV maximum**.
 *
 * La formule vit dans `combatantFromHero` : c'est le seul endroit où le `maxHp`
 * du combattant est dérivé du héros (PV de niveau + PV d'objets + Vitalité
 * totale, capital et équipement compris). Les valeurs attendues sont lues dans
 * `data/` : aucune constante métier recopiée ici.
 */

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));
const items = parseItemsYaml(read("items.yaml"));
const sets = parseSetsYaml(read("sets.yaml"));
const progression = parseProgressionYaml(read("progression.yaml"));

/** Classe du walkthrough et chapeau du kit : les données décident, pas le test. */
const IOP: ClassDef = mustFind(classes, "iop");
const STARTING_HAT: ItemDef = mustFind(items, "chapeau_piou_mazoute");
/** Donjon de `data/` : la clef et les salles viennent du même catalogue. */
const DUNGEON: DungeonDef = mustFind(dungeons, "fer_donjon_casse_vis_sans_fin");

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

function heroWith(vitality: number): Hero {
  return { ...createHero("Anselme", IOP), vitality };
}

function combatantOf(hero: Hero, inventory: InventoryState = emptyInventory()) {
  const stats = totalStatsFor({ hero, inventory, items, sets });
  return combatantFromHero({ hero, stats, position: { x: 0, y: 0 }, spellIds: [] });
}

function maxHpOf(hero: Hero, inventory: InventoryState = emptyInventory()): number {
  return combatantOf(hero, inventory).maxHp;
}

function withHat(): InventoryState {
  return equipItem({ inventory: emptyInventory(), item: STARTING_HAT });
}

/** Le bonus du chapeau vient de `data/items.yaml`, pas d'un `5` écrit ici. */
function hatVitality(): number {
  if (STARTING_HAT.category !== "equipment") throw new Error("le chapeau du kit doit être un équipement");
  return STARTING_HAT.stats.vitality ?? 0;
}

/** Héros réellement monté au niveau 16 par `gainXp`, capital inclus. */
function levelSixteen(): Hero {
  const options = { hero: createHero("Anselme", IOP), amount: 75_000, gainRules: progression.gainRules };
  return gainXp({ ...options, tiers: progression.xpThresholds, apRules: progression.apRules }).hero;
}

describe("vitalité → PV (1.29 : 1 point = 1 PV)", () => {
  it("ajoute exactement 1 PV maximum par point de Vitalité", () => {
    const bare = maxHpOf(heroWith(0));
    const tenPoints = maxHpOf(heroWith(10));
    expect(tenPoints - bare).toBe(10);
  });

  it("compte les points investis au capital comme des PV", () => {
    const hero = { ...createHero("Anselme", IOP), capitalPoints: 10 };
    const spent = spendCapitalPoints({ hero, stat: "vitality", points: 10, classDef: IOP }).hero;
    expect(spent.vitality).toBe(10);
    expect(maxHpOf(spent)).toBe(maxHpOf(hero) + 10);
  });

  it("traduit les +Vitalité du chapeau du kit en autant de PV", () => {
    const hatBonus = hatVitality();
    expect(hatBonus).toBe(5);
    expect(maxHpOf(heroWith(0), withHat())).toBe(maxHpOf(heroWith(0)) + hatBonus);
  });

  it("cumule les PV de niveau et les PV de capital : 50 + 75 + 75 = 200", () => {
    const leveled = levelSixteen();
    expect(leveled.level).toBe(16);
    expect(leveled.maxHp).toBe(IOP.baseHp + 75);
    const points = leveled.capitalPoints;
    const spent = spendCapitalPoints({ hero: leveled, stat: "vitality", points, classDef: IOP }).hero;
    expect(spent.vitality).toBe(75);
    expect(maxHpOf(spent)).toBe(IOP.baseHp + 75 + 75);
  });
});

describe("PV courants quand la Vitalité gonfle le maximum", () => {
  it("garde plein un héros qui était pleine vie", () => {
    const hero = { ...heroWith(10), hp: IOP.baseHp, maxHp: IOP.baseHp };
    const combatant = combatantOf(hero);
    expect(combatant.maxHp).toBe(IOP.baseHp + 10);
    expect(combatant.hp).toBe(IOP.baseHp + 10);
  });

  it("ne soigne pas un héros blessé : la Vitalité ajoute son bonus, le manque reste", () => {
    const hero = { ...heroWith(10), hp: IOP.baseHp - 5, maxHp: IOP.baseHp };
    const combatant = combatantOf(hero);
    expect(combatant.maxHp).toBe(IOP.baseHp + 10);
    // Projection additive : 45 PV persistés + 10 Vitalité = 55, il manque toujours 5 PV.
    expect(combatant.hp).toBe(IOP.baseHp - 5 + 10);
    expect(combatant.maxHp - combatant.hp).toBe(5);
  });

  it("laisse intact un héros sans aucune Vitalité", () => {
    const hero = { ...heroWith(0), hp: IOP.baseHp - 10, maxHp: IOP.baseHp };
    expect(combatantOf(hero)).toMatchObject({ hp: IOP.baseHp - 10, maxHp: IOP.baseHp });
  });
});

function vitalityBuild(): Hero {
  const leveled = levelSixteen();
  const points = leveled.capitalPoints;
  return spendCapitalPoints({ hero: leveled, stat: "vitality", points, classDef: IOP }).hero;
}

function inventoryWithKey(): InventoryState {
  return addItem({ inventory: emptyInventory(), itemId: DUNGEON.keyItemId, quantity: 1 });
}

function battleOrThrow(): BattleState {
  const { battle } = useCombatStore.getState();
  if (battle === null) throw new Error("aucune bataille de donjon");
  return battle;
}

function playerOf(state: BattleState): CombatantLike {
  const player = state.combatants.find((entry) => entry.side === "player");
  if (player === undefined) throw new Error("héros absent de la bataille");
  return player;
}

/** Salle gagnée : ennemis à 0 et héros laissé à `hp` PV effectifs. */
function winRoomAt(hp: number): CombatantLike {
  const state = battleOrThrow();
  const combatants = state.combatants.map((entry) => ({ ...entry, hp: entry.side === "player" ? hp : 0 }));
  useCombatStore.setState({ battle: { ...state, combatants } });
  return playerOf(battleOrThrow());
}

/** Héros niveau 16 avec 75 points en Vitalité (max effectif 200) + clef du donjon. */
function enterFirstRoom(): void {
  useGameStore.setState({ hero: vitalityBuild(), inventory: inventoryWithKey() });
  expect(useCombatStore.getState().enterDungeonRun({ dungeonId: DUNGEON.id })).toBe(true);
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

describe("aller-retour domaine de niveau ↔ domaine effectif (aucun soin entre salles)", () => {
  it("démarre la salle 2 à 132 PV, pas au maximum effectif de 200", () => {
    enterFirstRoom();
    const end = winRoomAt(132);
    expect(end.maxHp).toBe(IOP.baseHp + 75 + 75);
    useCombatStore.getState().settleDungeonRoom();
    const start = playerOf(battleOrThrow());
    expect(start.hp).toBe(132);
    expect(useGameStore.getState().hero?.hp).toBe(132 - 75);
  });

  it("traverse saveGame → resetGame → loadGame sans gagner ni perdre un PV", () => {
    const storage = new MemoryStorage();
    enterFirstRoom();
    winRoomAt(132);
    useCombatStore.getState().settleDungeonRoom({ storage });
    const persisted = useGameStore.getState().hero?.hp;
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    const loaded = useGameStore.getState().hero;
    if (loaded === null) throw new Error("héros non rechargé");
    expect(loaded.hp).toBe(persisted);
    expect(combatantOf(loaded).hp).toBe(132);
  });
});
