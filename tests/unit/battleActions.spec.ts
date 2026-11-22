import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { computeDamage } from "../../src/engine/combat/damage";
import { roomMonsters } from "../../src/engine/dungeon";
import type { DungeonRoom } from "../../src/engine/dungeon";
import type { BattleState } from "../../src/engine/multiCombat";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { rollSpellBase, spellAttackSpec } from "../../src/store/battleSelectors";
import { useCombatStore } from "../../src/store/useCombatStore";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const spells = parseSpellsYaml(read("spells.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));

const DUNGEON_ID = "fer_donjon_casse_vis_sans_fin";

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

function roomOne(): DungeonRoom {
  const dungeon: DungeonDef = mustFind(dungeons, DUNGEON_ID);
  const room = dungeon.rooms[0];
  if (room === undefined) throw new Error("salle 1 absente");
  return room;
}

const PRESSION = mustFind(spells, "pression");
const EPEE = mustFind(spells, "epee_du_destin");

const battle = (): BattleState | null => useCombatStore.getState().battle;

function withActive(id: string): BattleState {
  const state = battle();
  if (state === null) throw new Error("aucun battle");
  return { ...state, activeIndex: Math.max(0, state.order.indexOf(id)) };
}

function findIn(id: string) {
  return battle()?.combatants.find((entry) => entry.id === id);
}

/** Le héros apparaît sur une case `P` : on amène la cible au contact pour le cast. */
function bringAdjacent(targetId: string): void {
  const state = battle();
  const hero = findIn("player");
  if (state === null || hero === undefined) throw new Error("battle incomplet");
  const next = { x: hero.position.x + 1, y: hero.position.y };
  const combatants = state.combatants.map((entry) => (entry.id === targetId ? { ...entry, position: next } : entry));
  useCombatStore.setState({ battle: { ...state, combatants } });
}

beforeEach(() => {
  useCombatStore.setState({ battle: null, combat: null, mode: "exploration", exploration: null });
  useCombatStore.getState().startDungeonRoom({ room: roomOne() });
  useCombatStore.setState({ battle: withActive("player") });
});

describe("rollSpellBase — tirage piloté par le YAML", () => {
  it("rend le minimum pour rng 0 et le maximum pour rng maximal", () => {
    expect(PRESSION.damage).toBeDefined();
    expect(rollSpellBase(PRESSION, () => 0)).toBe(PRESSION.damage?.min);
    expect(rollSpellBase(PRESSION, () => 0.999_999)).toBe(PRESSION.damage?.max);
  });

  it("rend zéro pour un sort sans dégâts", () => {
    const teleport = mustFind(spells, "bond");
    expect(rollSpellBase(teleport, () => 0)).toBe(0);
  });
});

describe("spellAttackSpec — pont SpellDef → AttackSpec", () => {
  it("reprend base, élément, coût en PA et poussée du sort", () => {
    expect(spellAttackSpec(PRESSION, 8)).toEqual({
      base: 8,
      element: "earth",
      baseCrit: 0,
      apCost: PRESSION.apCost,
      pushCells: 0,
    });
    expect(spellAttackSpec(EPEE, 10).pushCells).toBe(EPEE.pushCells);
    expect(spellAttackSpec(EPEE, 10).element).toBe(EPEE.element);
  });
});

describe("useCombatStore.battleSpellAttack — attaque du héros", () => {
  it("frappe la cible avec le sort de dégâts du héros, sans chiffre en dur", () => {
    bringAdjacent("piou_mazoute-0");
    const hero = findIn("player");
    const target = findIn("piou_mazoute-0");
    if (hero === undefined || target === undefined) throw new Error("fixture incomplète");
    const expected = computeDamage({
      base: PRESSION.damage?.min ?? 0,
      stat: hero.stats.strength,
      flatRes: target.resistances.flat.earth,
      pctRes: target.resistances.percent.earth,
      isPlayer: false,
    });
    useCombatStore.getState().battleSpellAttack({ targetId: "piou_mazoute-0", rng: () => 0 });
    expect(findIn("piou_mazoute-0")?.hp).toBe(target.hp - expected);
    expect(findIn("player")?.ap).toBe(hero.ap - PRESSION.apCost);
    expect(battle()?.log.at(-1)).toContain("Piou Mazouté");
  });

  it("refuse quand ce n'est pas au camp du héros de jouer", () => {
    const previous = withActive("piou_mazoute-0");
    useCombatStore.setState({ battle: previous });
    useCombatStore.getState().battleSpellAttack({ targetId: "player", rng: () => 0 });
    expect(battle()).toBe(previous);
  });

  it("refuse de frapper le héros lui-même", () => {
    const previous = battle();
    useCombatStore.getState().battleSpellAttack({ targetId: "player", rng: () => 0 });
    expect(battle()).toBe(previous);
  });

  it("ne fait rien sans battle", () => {
    useCombatStore.setState({ battle: null });
    useCombatStore.getState().battleSpellAttack({ targetId: "piou_mazoute-0", rng: () => 0 });
    expect(battle()).toBeNull();
  });
});

describe("useCombatStore — la salle expose bien les N ennemis attendus", () => {
  it("compte 1 héros et 3 ennemis issus du YAML", () => {
    const enemies = battle()?.combatants.filter((entry) => entry.side === "enemy") ?? [];
    const expected = roomMonsters(roomOne()).reduce((total, group) => total + group.count, 0);
    expect(enemies).toHaveLength(expected);
    expect(enemies[0]?.name).toBe(mustFind(monsters, "piou_mazoute").name);
  });
});
