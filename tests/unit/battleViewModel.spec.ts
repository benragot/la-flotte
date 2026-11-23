import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { roomMonsters } from "../../src/engine/dungeon";
import type { DungeonRoom } from "../../src/engine/dungeon";
import { heroBattleCombatant, setupDungeonBattle } from "../../src/engine/dungeon/combatants";
import type { CombatantState } from "../../src/engine/combatLoop/types";
import { activeCombatant, buildTimeline } from "../../src/engine/multiCombat";
import type { BattleState } from "../../src/engine/multiCombat";
import { battleViewModel, colorForId, shouldRenderBattle } from "../../src/renderer/battleViewModel";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { MonsterDef } from "../../src/schemas/monsterSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";

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
  position: { x: 0, y: 0 },
  stats: { strength: 20, intelligence: 0, chance: 0, agility: 10, wisdom: 0 },
  resistances: { flat: { ...ZERO }, percent: { ...ZERO } },
  spellIds: [],
};

/** Vraie salle 1 : héros + 2 Piou Mazouté + 1 Rat d'Égoût-dron, issus du YAML. */
function realBattle(): BattleState {
  const hero = heroBattleCombatant({ combatant: HERO });
  const { combatants } = setupDungeonBattle({ hero: { combatant: hero }, monsters: roomGroups() });
  return { turn: 1, ...buildTimeline(combatants), combatants, log: [] };
}

function withActive(battle: BattleState, id: string): BattleState {
  return { ...battle, activeIndex: Math.max(0, battle.order.indexOf(id)) };
}

describe("battleViewModel — N combattants", () => {
  it("expose le héros puis les trois ennemis de la salle 1, dans l'ordre des combattants", () => {
    const views = battleViewModel(realBattle());
    expect(views.map((view) => view.id)).toEqual([
      "player",
      "piou_mazoute-0",
      "piou_mazoute-1",
      "fer_rat_de_cale-2",
    ]);
    expect(views.map((view) => view.name)).toEqual(["Balthazar", "Piou Mazouté", "Piou Mazouté", "Rat d'Égoût-dron"]);
  });

  it("reprend PV, PV max, PA et PM exacts des MonsterDef YAML", () => {
    const views = battleViewModel(realBattle());
    expect(views[1]).toMatchObject({ hp: 35, maxHp: 35, ap: 6, mp: 4 });
    expect(views[3]).toMatchObject({ hp: 52, maxHp: 52, ap: 5, mp: 4 });
    expect(views[0]).toMatchObject({ hp: 60, maxHp: 60, ap: 6, mp: 3, side: "player" });
  });

  it("rend une liste vide pour un battle absent", () => {
    expect(battleViewModel(null)).toEqual([]);
  });
});

describe("battleViewModel — actif et ciblable", () => {
  it("marque exactement le combattant actif de la timeline", () => {
    const battle = realBattle();
    const actives = battleViewModel(battle).filter((view) => view.isActive);
    expect(actives).toHaveLength(1);
    expect(actives[0]?.id).toBe(activeCombatant(battle)?.id);
  });

  it("cible les trois ennemis quand c'est au héros de jouer", () => {
    const views = battleViewModel(withActive(realBattle(), "player"));
    expect(views.filter((view) => view.isTargetable).map((view) => view.id)).toEqual([
      "piou_mazoute-0",
      "piou_mazoute-1",
      "fer_rat_de_cale-2",
    ]);
  });

  it("cible le héros seul quand un ennemi devient actif", () => {
    const views = battleViewModel(withActive(realBattle(), "piou_mazoute-0"));
    expect(views.filter((view) => view.isTargetable).map((view) => view.id)).toEqual(["player"]);
    expect(views.find((view) => view.id === "player")?.isActive).toBe(false);
  });

  it("retire des cibles un ennemi mort", () => {
    const base = withActive(realBattle(), "player");
    const combatants = base.combatants.map((entry) => (entry.id === "piou_mazoute-0" ? { ...entry, hp: 0 } : entry));
    const views = battleViewModel({ ...base, combatants });
    expect(views.filter((view) => view.isTargetable).map((view) => view.id)).toEqual([
      "piou_mazoute-1",
      "fer_rat_de_cale-2",
    ]);
    expect(views.find((view) => view.id === "piou_mazoute-0")?.hp).toBe(0);
  });
});

describe("battleViewModel — immuabilité", () => {
  it("ne mute pas le BattleState reçu", () => {
    const battle = realBattle();
    const before = structuredClone(battle);
    battleViewModel(battle);
    expect(battle).toEqual(before);
  });
});

describe("colorForId — couleur procédurale déterministe", () => {
  const IDS = ["player", "piou_mazoute-0", "piou_mazoute-1", "fer_rat_de_cale-2", "mud_test-0", "rat_test-0"];

  it("rend toujours la même couleur pour un même id", () => {
    IDS.forEach((id) => expect(colorForId(id)).toBe(colorForId(id)));
  });

  it("distingue des ids différents sur un échantillon", () => {
    expect(new Set(IDS.map(colorForId)).size).toBe(IDS.length);
  });

  it("produit une couleur CSS exploitable", () => {
    IDS.forEach((id) => expect(colorForId(id)).toMatch(/^hsl\(\d{1,3} \d{1,3}% \d{1,3}%\)$/));
  });
});

describe("shouldRenderBattle — gating", () => {
  it("refuse l'absence de battle et accepte un battle vivant", () => {
    expect(shouldRenderBattle(null)).toBe(false);
    expect(shouldRenderBattle(realBattle())).toBe(true);
  });
});
