import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createSeededRng, initExploration, seedForMap } from "../../src/engine/exploration";
import type { SpawnPlan } from "../../src/engine/exploration";
import { getCell, parseAsciiMap, samePosition } from "../../src/engine/grid";
import type { AsciiMap, Position } from "../../src/engine/grid";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpawnsYaml } from "../../src/schemas/spawnSchema";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";

/** `ferraille_plage_01` recopiée : le moteur ne lit jamais de YAML. */
const PLAGE_ROWS = [
  "~~~~~~~~....",
  "~~~~....###.",
  "~~~...##..#.",
  "~~.P.......#",
  "~~....##....",
  "~~....##....",
  "...###......",
  "......~~~~..",
  "..#.....#...",
  "..#..M..#...",
  "..#.....#...",
  "............",
];

/** Sortie réelle de la plage : aucune donnée de carte n'entre dans le moteur. */
const EXITS: readonly Position[] = [{ x: 11, y: 4 }];
const HERO_CELL = { x: 3, y: 3 };
const MIN_HERO_GAP = 3;
const SPAWN = { monsterId: "piou_mazoute", monsterName: "Piou Mazouté", level: 1 };

/** Vivier de la plage, poids réels : 100 / 30 sur 130. */
const ROSTER = [
  { monsterId: "piou_mazoute", monsterName: "Piou Mazouté", level: 1, weight: 100 },
  { monsterId: "fer_rat_de_cale", monsterName: "Rat d'Égoût-dron", level: 3, weight: 30 },
];

const PLAN: SpawnPlan = {
  groups: { min: 3, max: 4 },
  members: { min: 1, max: 3 },
  roster: ROSTER,
};

const HERO = { name: "Anselme", classId: "iop" };

function plage(): AsciiMap {
  return parseAsciiMap(PLAGE_ROWS);
}

function seeded(seed: number, plan: SpawnPlan = PLAN) {
  const options = { map: plage(), ...SPAWN, plan, rng: createSeededRng(seed) };
  return initExploration({ ...options, safeCells: EXITS });
}

function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function keyOf(pos: Position): string {
  return `${pos.x},${pos.y}`;
}

function dataDir(file: string): string {
  return readFileSync(join(process.cwd(), "data", file), "utf8");
}

function storeGroupCount(): number {
  return useCombatStore.getState().exploration?.monsterGroups.length ?? 0;
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  useGameStore.getState().createCharacter(HERO);
  useCombatStore.getState().startExploration();
});

describe("placement — trois à quatre groupes sur la plage", () => {
  it("pose trois ou quatre groupes sur une carte qui en demandait un seul", () => {
    const count = seeded(7).monsterGroups.length;
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(4);
  });

  it("donne un à trois monstres par groupe", () => {
    seeded(7).monsterGroups.forEach((group) => {
      expect(group.monsterIds.length).toBeGreaterThanOrEqual(1);
      expect(group.monsterIds.length).toBeLessThanOrEqual(3);
      expect(group.totalLevel).toBeGreaterThanOrEqual(1);
    });
  });

  it("tire chaque monstre du vivier de la zone, jamais d'une constante", () => {
    const rosterIds = new Set(ROSTER.map((entry) => entry.monsterId));
    seeded(7).monsterGroups.forEach((group) => {
      group.monsterIds.forEach((monsterId) => expect(rosterIds.has(monsterId)).toBe(true));
    });
  });
});

describe("placement — interdits de terrain", () => {
  it("ne pose jamais deux groupes sur la même case", () => {
    const keys = seeded(7).monsterGroups.map((group) => keyOf(group.pos));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ne pose aucun groupe sur un mur ni sur l'eau", () => {
    const map = plage();
    seeded(7).monsterGroups.forEach((group) => {
      const cell = getCell(map, group.pos);
      expect(cell === "#" || cell === "~").toBe(false);
    });
  });

  it("ne pose aucun groupe sur la case du héros", () => {
    seeded(7).monsterGroups.forEach((group) => {
      expect(samePosition(group.pos, HERO_CELL)).toBe(false);
    });
  });

  it("ne pose aucun groupe sur une case de sortie", () => {
    seeded(7).monsterGroups.forEach((group) => {
      expect(EXITS.some((exit) => samePosition(exit, group.pos))).toBe(false);
    });
  });

});

describe("placement — interdits d'occupation", () => {
  it("laisse au moins trois cases entre le héros et chaque groupe", () => {
    seeded(7).monsterGroups.forEach((group) => {
      expect(manhattan(group.pos, HERO_CELL)).toBeGreaterThanOrEqual(MIN_HERO_GAP);
    });
  });

  it("garde toutes les cases dans la grille", () => {
    const map = plage();
    seeded(7).monsterGroups.forEach((group) => {
      expect(group.pos.x).toBeLessThan(map.width);
      expect(group.pos.y).toBeLessThan(map.height);
      expect(group.pos.x).toBeGreaterThanOrEqual(0);
      expect(group.pos.y).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("placement — déterminisme", () => {
  it("rejoue exactement la même disposition pour la même graine", () => {
    expect(seeded(42).monsterGroups).toEqual(seeded(42).monsterGroups);
  });

  it("ne dépend pas d'un aléa global : deux graines diffèrent", () => {
    expect(seeded(1).monsterGroups).not.toEqual(seeded(7).monsterGroups);
  });

  it("dérive une graine stable de l'identifiant de carte", () => {
    expect(seedForMap("ferraille_plage_01")).toBe(seedForMap("ferraille_plage_01"));
    expect(seedForMap("ferraille_plage_01")).not.toBe(seedForMap("ferraille_quai_02"));
  });
});

describe("placement — carte trop petite", () => {
  const TINY_ROWS = ["P...", "...."];

  function tiny(): AsciiMap {
    return parseAsciiMap(TINY_ROWS);
  }

  function tinyPlan(): SpawnPlan {
    return { ...PLAN, groups: { min: 5, max: 5 } };
  }

  it("place ce qu'elle peut sans boucler et le journalise", () => {
    const state = initExploration({ map: tiny(), ...SPAWN, plan: tinyPlan(), rng: createSeededRng(3) });
    expect(state.monsterGroups.length).toBeGreaterThan(0);
    expect(state.monsterGroups.length).toBeLessThan(5);
    expect(state.log.at(-1)).toContain("incomplet");
  }, 1000);

  it("termine même quand aucune case n'est plaçable", () => {
    const map = parseAsciiMap(["P#", "##"]);
    const state = initExploration({ map, ...SPAWN, plan: tinyPlan(), rng: createSeededRng(3) });
    expect(state.monsterGroups).toEqual([]);
    expect(state.log.at(-1)).toContain("incomplet");
  }, 1000);
});

const SPAWNS = parseSpawnsYaml(dataDir("spawns.yaml"));
const MONSTERS = parseMonstersYaml(dataDir("monsters.yaml"));
const MAPS = parseMapsYaml(dataDir("maps.yaml"));
const MAP_ID = useCombatStore.getState().mapId;
const START_ZONE = SPAWNS.find((entry) => entry.mapId === MAP_ID);
const START_MAP = MAPS.find((entry) => entry.id === MAP_ID);
const START_ASCII = parseAsciiMap(START_MAP?.grid ?? []);

describe("store — l'exploration réelle pose trois à quatre groupes", () => {
  it("respecte les bornes déclarées en donnée", () => {
    if (START_ZONE === undefined) throw new Error(`aucune zone pour ${MAP_ID}`);
    expect(storeGroupCount()).toBeGreaterThanOrEqual(START_ZONE.groups.min);
    expect(storeGroupCount()).toBeLessThanOrEqual(START_ZONE.groups.max);
  });

  it("n'emploie que des monstres de la zone", () => {
    if (START_ZONE === undefined) throw new Error(`aucune zone pour ${MAP_ID}`);
    const zoneIds = new Set(START_ZONE.monsters.map((entry) => entry.monsterId));
    const groups = useCombatStore.getState().exploration?.monsterGroups ?? [];
    groups.flatMap((group) => group.monsterIds).forEach((monsterId) => {
      expect(zoneIds.has(monsterId)).toBe(true);
      expect(MONSTERS.some((monster) => monster.id === monsterId)).toBe(true);
    });
  });

  it("n'occupe ni un mur, ni une sortie, ni la case du héros", () => {
    const exploration = useCombatStore.getState().exploration;
    const exits = START_MAP?.exits ?? [];
    exploration?.monsterGroups.forEach((group) => {
      const cell = getCell(START_ASCII, group.pos);
      expect(cell === "#" || cell === "~").toBe(false);
      expect(exits.some((exit) => samePosition(exit, group.pos))).toBe(false);
      expect(samePosition(group.pos, exploration.playerPos)).toBe(false);
      expect(manhattan(group.pos, exploration.playerPos)).toBeGreaterThanOrEqual(MIN_HERO_GAP);
    });
  });

  it("rejoue la même carte avec la même disposition", () => {
    const first = structuredClone(useCombatStore.getState().exploration?.monsterGroups);
    useCombatStore.getState().startExploration();
    expect(useCombatStore.getState().exploration?.monsterGroups).toEqual(first);
  });
});
