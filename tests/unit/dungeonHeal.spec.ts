import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { healBetweenRooms } from "../../src/engine/dungeon";
import type { Hero } from "../../src/engine/createHero";
import { combatantFromHero, heroHpFromCombat } from "../../src/engine/hero/combatant";
import { totalStatsFor } from "../../src/engine/hero/totalStats";
import { addItem } from "../../src/engine/inventory";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import { isVictory } from "../../src/engine/multiCombat";
import type { StorageLike } from "../../src/engine/save";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import { GAME_CATALOG, useGameStore } from "../../src/store/useGameStore";
import { useCombatStore } from "../../src/store/useCombatStore";

/**
 * DEC-03 — le soin entre les salles est AUTORISÉ (entorse assumée à Dofus 1.29).
 *
 * Ce que ce fichier verrouille :
 *   - le ratio vient de `data/dungeons.yaml` (`healBetweenRooms`), pas du code ;
 *   - le soin porte sur le pool EFFECTIF (`hero.maxHp + équipement + Vitalité`)
 *     et le retour à la persistance reste cohérent (`heroHpFromCombat`) ;
 *   - un seul chemin : le franchissement d'une salle gagnée. Aucun soin à
 *     l'entrée du donjon, en cours de salle, après la dernière salle, au
 *     rechargement, ni au second clic sur « Clore la salle ».
 */

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const DUNGEON: DungeonDef = first(parseDungeonsYaml(read("dungeons.yaml")), "donjon");
const RATIO = DUNGEON.healBetweenRooms;

function first<T>(list: readonly T[], label: string): T {
  const value = list[0];
  if (value === undefined) throw new Error(`data/ ne déclare aucun ${label}`);
  return value;
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

function statsFor(hero: Hero) {
  const { inventory } = useGameStore.getState();
  return totalStatsFor({ hero, inventory, items: GAME_CATALOG.items, sets: GAME_CATALOG.sets });
}

/** PV effectifs du héros persisté, recalculés hors bataille (contrôle indépendant). */
function effectiveHpOf(hero: Hero): number {
  const spellIds: string[] = [];
  return combatantFromHero({ hero, stats: statsFor(hero), position: { x: 0, y: 0 }, spellIds }).hp;
}

/** Chapeau du kit : seule source de Vitalité « +PV » au niveau 1, lue au YAML. */
function startingHatId(): string {
  const hats = parseItemsYaml(read("items.yaml")).filter(
    (item) => item.category === "equipment" && item.starting === true && item.slot === "hat",
  );
  const hat = hats[0];
  if (hat === undefined) throw new Error("aucun chapeau de départ dans data/items.yaml");
  return hat.id;
}

/** Héros de test avec un pool effectif strictement supérieur au pool de niveau. */
function prepareHero(): void {
  useGameStore.getState().createCharacter({ name: "Anselme", classId: "iop" });
  useGameStore.getState().equip({ itemId: startingHatId() });
}

function stockKey(): void {
  const { inventory } = useGameStore.getState();
  useGameStore.setState({ inventory: addItem({ inventory, itemId: DUNGEON.keyItemId, quantity: 1 }) });
}

function enterDungeon(): void {
  prepareHero();
  stockKey();
  expect(useCombatStore.getState().enterDungeonRun({ dungeonId: DUNGEON.id })).toBe(true);
}

/** Salle courante gagnée d'un coup : héros à `hp` PV effectifs, tous les monstres à 0. */
function winCurrentRoom(hp: number): BattleState {
  const state = battleOrThrow();
  const combatants = state.combatants.map((entry) => ({ ...entry, hp: entry.side === "player" ? hp : 0 }));
  const won = { ...state, combatants };
  useCombatStore.setState({ battle: won });
  expect(isVictory(won)).toBe(true);
  return won;
}

function healAmount(maxHp: number): number {
  return Math.ceil(maxHp * RATIO);
}

function healLines(log: readonly string[], healed: number): string[] {
  return log.filter((line) => line.includes(`${healed} PV`));
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

describe("heroHpFromCombat — un héros vivant ne se persiste pas mort", () => {
  it("rend au moins 1 PV de niveau quand les PV effectifs couvrent à peine le bonus d'équipement", () => {
    prepareHero();
    const hero = heroOrThrow();
    expect(heroHpFromCombat(1, hero, statsFor(hero))).toBeGreaterThanOrEqual(1);
  });

  it("laisse 0 PV à un héros réellement tombé", () => {
    prepareHero();
    const hero = heroOrThrow();
    expect(heroHpFromCombat(0, hero, statsFor(hero))).toBe(0);
  });
});

describe("healBetweenRooms — fonction pure, ratio de données", () => {
  it("rend ceil(max × ratio) de PV sur le pool effectif", () => {
    expect(healBetweenRooms({ hp: 100, maxHp: 303, ratio: 0.35 })).toEqual({ hp: 100 + 107, healed: 107 });
  });

  it("borne le soin au maximum effectif", () => {
    expect(healBetweenRooms({ hp: 199, maxHp: 200, ratio: 1 })).toEqual({ hp: 200, healed: 1 });
  });

  it("ne soigne rien avec un ratio neutre (0) : le champ optionnel peut être inerte", () => {
    expect(healBetweenRooms({ hp: 42, maxHp: 200, ratio: 0 })).toEqual({ hp: 42, healed: 0 });
  });

  it("ne soigne pas un héros déjà plein", () => {
    expect(healBetweenRooms({ hp: 200, maxHp: 200, ratio: 1 })).toEqual({ hp: 200, healed: 0 });
  });
});

describe("franchissement d'une salle — pool effectif et journal", () => {
  it("soigne le pool effectif et persiste le domaine de niveau sans décalage", () => {
    enterDungeon();
    const maxHp = playerOf(battleOrThrow()).maxHp;
    const bonus = maxHp - heroOrThrow().maxHp;
    expect(bonus).toBeGreaterThan(0);
    winCurrentRoom(10);
    const expected = Math.min(maxHp, 10 + healAmount(maxHp));
    expect(expected).toBeLessThan(maxHp);
    useCombatStore.getState().settleDungeonRoom();
    expect(playerOf(battleOrThrow()).hp).toBe(expected);
    expect(heroOrThrow().hp).toBe(expected - bonus);
    expect(effectiveHpOf(heroOrThrow())).toBe(expected);
  });

  it("journalise une phrase qui dit le soin et son montant", () => {
    enterDungeon();
    const maxHp = playerOf(battleOrThrow()).maxHp;
    winCurrentRoom(10);
    const healed = Math.min(maxHp, 10 + healAmount(maxHp)) - 10;
    useCombatStore.getState().settleDungeonRoom();
    const [line] = healLines(battleOrThrow().log, healed);
    if (line === undefined) throw new Error(`aucune ligne de soin dans ${JSON.stringify(battleOrThrow().log)}`);
    expect(line).toContain(`${healed} PV`);
    expect(line.split(" ").length).toBeGreaterThan(4);
  });
});

describe("franchissement d'une salle — un seul chemin de soin", () => {
  it("est idempotent : un second « Clore la salle » ne soigne pas une deuxième fois", () => {
    enterDungeon();
    const maxHp = playerOf(battleOrThrow()).maxHp;
    winCurrentRoom(10);
    const healed = Math.min(maxHp, 10 + healAmount(maxHp)) - 10;
    useCombatStore.getState().settleDungeonRoom();
    const once = { hp: heroOrThrow().hp, room: useCombatStore.getState().dungeonRun?.roomIndex };
    const battle = battleOrThrow();
    useCombatStore.getState().settleDungeonRoom();
    expect(heroOrThrow().hp).toBe(once.hp);
    expect(useCombatStore.getState().dungeonRun?.roomIndex).toBe(once.room);
    expect(useCombatStore.getState().battle).toBe(battle);
    expect(healLines(battleOrThrow().log, healed)).toHaveLength(1);
  });

  it("n'ouvre aucun soin en cours de salle : une salle non gagnée est refusée", () => {
    enterDungeon();
    const battle = battleOrThrow();
    const heroHp = heroOrThrow().hp;
    useCombatStore.getState().settleDungeonRoom();
    expect(useCombatStore.getState().battle).toBe(battle);
    expect(heroOrThrow().hp).toBe(heroHp);
    expect(battleOrThrow().log.some((line) => line.includes("PV"))).toBe(false);
  });
});

describe("franchissement d'une salle — bornes", () => {
  it("ne rend rien à un héros plein : aucun soin, aucune ligne", () => {
    enterDungeon();
    const maxHp = playerOf(battleOrThrow()).maxHp;
    winCurrentRoom(maxHp);
    useCombatStore.getState().settleDungeonRoom();
    expect(playerOf(battleOrThrow()).hp).toBe(maxHp);
    expect(effectiveHpOf(heroOrThrow())).toBe(maxHp);
    expect(battleOrThrow().log.some((line) => line.includes("PV repris"))).toBe(false);
  });

  it("n'accorde rien après la dernière salle", () => {
    enterDungeon();
    for (const index of [0, 1, 2]) {
      expect(useCombatStore.getState().dungeonRun?.roomIndex).toBe(index);
      winCurrentRoom(10);
      useCombatStore.getState().settleDungeonRoom();
    }
    expect(useCombatStore.getState().dungeonRun?.roomIndex).toBe(DUNGEON.rooms.length - 1);
    const hero = heroOrThrow();
    const stats = statsFor(hero);
    winCurrentRoom(10);
    useCombatStore.getState().settleDungeonRoom();
    expect(useCombatStore.getState().dungeonRun).toBeNull();
    expect(useCombatStore.getState().battle).toBeNull();
    expect(heroOrThrow().hp).toBe(heroHpFromCombat(10, hero, stats));
  });

  it("ne soigne pas à l'entrée du donjon", () => {
    enterDungeon();
    const hero = heroOrThrow();
    expect(battleOrThrow().log).toEqual([`Entrée dans ${DUNGEON.rooms[0]?.name}`]);
    expect(playerOf(battleOrThrow()).hp).toBe(effectiveHpOf(hero));
    expect(healLines(battleOrThrow().log, healAmount(hero.maxHp))).toEqual([]);
  });
});

describe("aller-retour de sauvegarde après un soin", () => {
  it("retrouve les PV soignés après saveGame → resetGame → loadGame", () => {
    enterDungeon();
    const storage = new MemoryStorage();
    const maxHp = playerOf(battleOrThrow()).maxHp;
    winCurrentRoom(10);
    useCombatStore.getState().settleDungeonRoom({ storage });
    const persisted = heroOrThrow().hp;
    const healedEffective = playerOf(battleOrThrow()).hp;
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    expect(heroOrThrow().hp).toBe(persisted);
    expect(effectiveHpOf(heroOrThrow())).toBe(healedEffective);
    expect(healedEffective).toBeLessThanOrEqual(maxHp);
  });

  it("ne soigne pas au rechargement en cours de donjon", () => {
    enterDungeon();
    const storage = new MemoryStorage();
    winCurrentRoom(10);
    useCombatStore.getState().settleDungeonRoom({ storage });
    const wounded = heroOrThrow().hp;
    expect(wounded).toBeLessThan(heroOrThrow().maxHp);
    useGameStore.getState().saveGame(storage);
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    expect(heroOrThrow().hp).toBe(wounded);
  });
});

describe("export / import JSON après un soin", () => {
  it("conserve les PV du pool effectif sans en rendre", () => {
    enterDungeon();
    const maxHp = playerOf(battleOrThrow()).maxHp;
    winCurrentRoom(10);
    expect(maxHp).toBeGreaterThan(0);
    useCombatStore.getState().settleDungeonRoom();
    const healed = playerOf(battleOrThrow()).hp;
    const raw = useGameStore.getState().exportJson();
    if (raw === null) throw new Error("aucune sauvegarde exportable");
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().importJson(raw)).toBe(true);
    expect(effectiveHpOf(heroOrThrow())).toBe(healed);
  });
});
