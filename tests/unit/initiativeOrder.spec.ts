import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { roomMonsters } from "../../src/engine/dungeon";
import type { DungeonRoom } from "../../src/engine/dungeon";
import { heroBattleCombatant, setupDungeonBattle } from "../../src/engine/dungeon/combatants";
import type { CombatantState } from "../../src/engine/combatLoop/types";
import { buildTimeline } from "../../src/engine/multiCombat";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import { initiativeOrder } from "../../src/renderer/battleViewModel";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { MonsterDef } from "../../src/schemas/monsterSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";

/**
 * COMBAT-05 — l'ordre d'initiative des vivants, tel que le panneau le lit.
 *
 * Le sélecteur ne calcule aucune règle : il suit `state.order` (DEC-12) et
 * applique le même filtre `isAlive` que la liste des combattants (COMBAT-04).
 * Les valeurs attendues sont celles de la salle 1 du donjon de `data/`.
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const monsters = parseMonstersYaml(read("monsters.yaml"));
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));

const DUNGEON_ID = "fer_donjon_casse_vis_sans_fin";
const ZERO = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };

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

function roomGroups(): { monster: MonsterDef; count: number }[] {
  return roomMonsters(roomOne()).map((group) => ({ monster: mustFind(monsters, group.monsterId), count: group.count }));
}

const HERO: CombatantState = {
  id: "player",
  kind: "player",
  name: "Balthazar",
  level: 1,
  hp: 60,
  maxHp: 60,
  ap: 6,
  maxAp: 6,
  mp: 3,
  maxMp: 3,
  accuracyPct: 0,
  pp: 0,
  percentDmg: 0,
  position: { x: 0, y: 0 },
  stats: { strength: 20, intelligence: 0, chance: 0, agility: 10, wisdom: 0 },
  resistances: { flat: { ...ZERO }, percent: { ...ZERO } },
  spellIds: [],
};

/** Vraie salle 1 : héros (init 30) + 2 Piou (init 0) + Rat (init 52). */
function realBattle(): BattleState {
  const hero = heroBattleCombatant({ combatant: HERO });
  const { combatants } = setupDungeonBattle({ hero: { combatant: hero }, monsters: roomGroups() });
  return { turn: 1, ...buildTimeline(combatants), combatants, log: [] };
}

function withActive(battle: BattleState, id: string): BattleState {
  return { ...battle, activeIndex: Math.max(0, battle.order.indexOf(id)) };
}

/** Force les PV des ids donnés : `0` les tue sans toucher à `order`. */
function withHp(battle: BattleState, ids: readonly string[], hp: number): BattleState {
  const combatants = battle.combatants.map((entry) => (ids.includes(entry.id) ? { ...entry, hp } : entry));
  return { ...battle, combatants };
}

function fighter(id: string, initiative: number, hp = 10): CombatantLike {
  const stats = { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };
  const vitals = { hp, maxHp: 10, ap: 6, maxAp: 6, mp: 3, maxMp: 3, position: { x: 0, y: 0 } };
  return {
    id,
    side: "enemy",
    name: id,
    level: 1,
    stats,
    resistances: { flat: { ...ZERO }, percent: { ...ZERO } },
    initiative,
    ...vitals,
  };
}

describe("initiativeOrder — ordre exact des vivants", () => {
  it("suit la timeline du moteur : Rat 52, héros 30, puis les Pious à 0", () => {
    const entries = initiativeOrder(realBattle());
    expect(entries.map((entry) => entry.id)).toEqual([
      "fer_rat_de_cale-2",
      "player",
      "piou_mazoute-0",
      "piou_mazoute-1",
    ]);
    expect(entries.map((entry) => entry.initiative)).toEqual([52, 30, 0, 0]);
    expect(entries.map((entry) => entry.name)).toEqual([
      "Rat d'Égoût-dron",
      "Balthazar",
      "Piou Mazouté",
      "Piou Mazouté",
    ]);
    expect(entries.map((entry) => entry.side)).toEqual(["enemy", "player", "enemy", "enemy"]);
  });

  it("numérote la séquence de 1 à N dans l'ordre de jeu", () => {
    expect(initiativeOrder(realBattle()).map((entry) => entry.position)).toEqual([1, 2, 3, 4]);
  });

  it("marque l'actif de la timeline, et lui seul", () => {
    const battle = withActive(realBattle(), "player");
    const actives = initiativeOrder(battle).filter((entry) => entry.isActive);
    expect(actives.map((entry) => entry.id)).toEqual(["player"]);
    expect(actives[0]?.position).toBe(2);
  });

  it("rend une liste vide pour une bataille absente", () => {
    expect(initiativeOrder(null)).toEqual([]);
  });
});

describe("initiativeOrder — les morts sortent de la bande", () => {
  it("retire le mort et renumérote les vivants sans trou", () => {
    const entries = initiativeOrder(withHp(realBattle(), ["fer_rat_de_cale-2"], 0));
    expect(entries.map((entry) => entry.id)).toEqual(["player", "piou_mazoute-0", "piou_mazoute-1"]);
    expect(entries.map((entry) => entry.position)).toEqual([1, 2, 3]);
  });

  it("ne marque aucun actif quand celui de la timeline est mort", () => {
    const entries = initiativeOrder(withHp(realBattle(), ["fer_rat_de_cale-2"], 0));
    expect(entries.filter((entry) => entry.isActive)).toEqual([]);
  });
});

describe("initiativeOrder — égalité d'initiative", () => {
  it("départage par id croissant, exactement comme buildTimeline", () => {
    const combatants = [fighter("b", 12), fighter("a", 12)];
    const timeline = buildTimeline(combatants);
    const battle: BattleState = { turn: 1, ...timeline, combatants, log: [] };
    expect(timeline.order).toEqual(["a", "b"]);
    expect(initiativeOrder(battle).map((entry) => entry.id)).toEqual(timeline.order);
  });

  it("garde l'initiative la plus haute devant une égalité", () => {
    const combatants = [fighter("a", 12), fighter("z", 40)];
    const timeline = buildTimeline(combatants);
    const battle: BattleState = { turn: 1, ...timeline, combatants, log: [] };
    expect(initiativeOrder(battle).map((entry) => entry.id)).toEqual(["z", "a"]);
  });
});
