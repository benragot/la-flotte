import { describe, expect, it } from "vitest";
import { getCell, isWalkableCell, parseAsciiMap, samePosition } from "../../src/engine/grid";
import type { Position } from "../../src/engine/grid";
import {
  createSeededRng,
  defeatGroup,
  initExploration,
  respawnMonsterGroup,
  seedForMap,
  seedForRespawn,
} from "../../src/engine/exploration";
import type { ExplorationState, MonsterGroup, SpawnPlan } from "../../src/engine/exploration";
import { canRespawnAfterVictory, useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";

/**
 * RESPAWN — « une carte vaincue doit rester peuplée ».
 *
 * CE QUE CE FICHIER PROUVE : un groupe vaincu est **remplacé immédiatement**
 * (retour en exploration), la carte remonte au `min` de sa zone, le tirage est
 * **seedé** par `(mapId, respawns déjà faits)`, les cinq interdits ET la marge
 * de trois cases (héros + chaque entrée `P`/sortie) tiennent, une carte saturée
 * ne place rien et s'arrête, et rien ne réapparaît en combat ni en donjon.
 */
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

const PLAGE_ID = "ferraille_plage_01";
/** Sortie est réelle de `ferraille_plage_01` (`data/maps.yaml`) : case marchable. */
const EXIT: Position = { x: 11, y: 4 };
const SPAWN = { monsterId: "piou_mazoute", monsterName: "Piou Mazouté", level: 1 };
const PLAN: SpawnPlan = {
  groups: { min: 3, max: 3 },
  members: { min: 1, max: 1 },
  roster: [{ ...SPAWN, weight: 1 }],
};
const REWARDS = { xpGained: 0, totalXp: 0, level: 1, levelUp: null, prospection: 0, drops: [] };

function seeded(mapId: string): ExplorationState {
  const options = { map: parseAsciiMap(PLAGE_ROWS), ...SPAWN, plan: PLAN, rng: createSeededRng(seedForMap(mapId)) };
  return initExploration({ ...options, safeCells: [EXIT] });
}

/** Respawn de jeu : la graine ne dépend que de `(mapId, respawns)`. */
function respawn(state: ExplorationState, input: { mapId: string; minGroups: number }): ExplorationState {
  const rng = createSeededRng(seedForRespawn(input.mapId, state.respawns));
  return respawnMonsterGroup({ state, spawn: SPAWN, minGroups: input.minGroups, rng });
}

/** Même départ, doublure de tirage imposée : sert à balayer toutes les candidates. */
function respawnWith(state: ExplorationState, rng: () => number): ExplorationState {
  return respawnMonsterGroup({ state, spawn: SPAWN, minGroups: state.monsterGroups.length + 1, rng });
}

/** Un tirage sur soixante : assez pour passer sur chaque zone interdite. */
const SWEEP: number[] = Array.from({ length: 60 }, (_, index) => index / 60);

function gap(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function addedGroups(before: ExplorationState, after: ExplorationState): MonsterGroup[] {
  return after.monsterGroups.slice(before.monsterGroups.length);
}

/** Une manche de jeu : le premier groupe tombe, puis la carte se repeuple. */
function respawnSequence(mapId: string): Position[][] {
  let current = seeded(mapId);
  const sequence: Position[][] = [];
  for (let round = 0; round < 3; round += 1) {
    const first = current.monsterGroups[0];
    current = first === undefined ? current : defeatGroup(current, first.id);
    const next = respawn(current, { mapId, minGroups: 3 });
    sequence.push(addedGroups(current, next).map((group) => group.pos));
    current = next;
  }
  return sequence;
}

describe("respawnMonsterGroup — remonte au minimum de la zone", () => {
  it("remet trois groupes après une victoire sur une carte à trois", () => {
    const state = seeded(PLAGE_ID);
    const first = state.monsterGroups[0];
    if (first === undefined) throw new Error("groupe attendu");
    const defeated = defeatGroup(state, first.id);
    const next = respawnMonsterGroup({ state: defeated, spawn: SPAWN, minGroups: 3, rng: createSeededRng(1) });
    expect(defeated.monsterGroups).toHaveLength(2);
    expect(next.monsterGroups).toHaveLength(3);
  });

  it("remonte de deux quand deux groupes ont été vaincus", () => {
    const state = seeded(PLAGE_ID);
    const [first, second] = state.monsterGroups;
    const twice = defeatGroup(defeatGroup(state, first?.id ?? ""), second?.id ?? "");
    const next = respawnMonsterGroup({ state: twice, spawn: SPAWN, minGroups: 3, rng: createSeededRng(2) });
    expect(twice.monsterGroups).toHaveLength(1);
    expect(next.monsterGroups).toHaveLength(3);
    expect(addedGroups(twice, next)).toHaveLength(2);
  });

  it("ne touche pas à une carte déjà à son minimum", () => {
    const state = seeded(PLAGE_ID);
    expect(respawnMonsterGroup({ state, spawn: SPAWN, minGroups: 3, rng: createSeededRng(0) })).toBe(state);
  });
});

describe("respawnMonsterGroup — cinq interdits et marge des entrées", () => {
  it("ajoute hors mur, eau, héros, sortie et groupe existant, pour tout tirage", () => {
    const state = seeded(PLAGE_ID);
    // Sans cette garde, une « sortie » posée sur un `#` rendrait les deux
    // assertions suivantes vertes par construction.
    expect(isWalkableCell(state.map, EXIT)).toBe(true);
    SWEEP.forEach((step) => {
      const added = addedGroups(state, respawnWith(state, () => step));
      expect(added).toHaveLength(1);
      added.forEach((group) => {
        const cell = getCell(state.map, group.pos);
        expect(isWalkableCell(state.map, group.pos)).toBe(true);
        expect(cell === "#" || cell === "~").toBe(false);
        expect(samePosition(group.pos, state.playerPos)).toBe(false);
        expect(samePosition(group.pos, EXIT)).toBe(false);
        expect(gap(group.pos, state.playerPos)).toBeGreaterThanOrEqual(3);
        expect(gap(group.pos, EXIT)).toBeGreaterThanOrEqual(3);
        const occupied = state.monsterGroups.some((entry) => samePosition(entry.pos, group.pos));
        expect(occupied).toBe(false);
      });
    });
  });

  it("écarte les abords des sorties, pas seulement ceux du héros", () => {
    const map = parseAsciiMap(["P.........#"]);
    const exit: Position = { x: 9, y: 0 };
    const state = initExploration({ map, ...SPAWN, safeCells: [exit] });
    const next = respawnMonsterGroup({ state, spawn: SPAWN, minGroups: state.monsterGroups.length + 1, rng: () => 0.999 });
    const added = addedGroups(state, next);
    expect(added).toHaveLength(1);
    expect(added[0]?.pos).toEqual({ x: 6, y: 0 });
    expect(samePosition(added[0]?.pos ?? state.playerPos, exit)).toBe(false);
    expect(gap(added[0]?.pos ?? state.playerPos, exit)).toBeGreaterThanOrEqual(3);
  });
});

describe("respawnMonsterGroup — déterminisme seedé", () => {
  it("rejoue les mêmes positions sur une partie neuve", () => {
    expect(respawnSequence(PLAGE_ID)).toEqual(respawnSequence(PLAGE_ID));
  });

  it("dérive une graine par carte et par rang de respawn", () => {
    expect(seedForRespawn(PLAGE_ID, 0)).toBe(seedForRespawn(PLAGE_ID, 0));
    expect(seedForRespawn(PLAGE_ID, 0)).not.toBe(seedForRespawn(PLAGE_ID, 1));
    expect(seedForRespawn(PLAGE_ID, 0)).not.toBe(seedForRespawn("ferraille_quai_02", 0));
  });

  it("compte les respawns pour faire avancer la graine", () => {
    const state = seeded(PLAGE_ID);
    const once = respawn(state, { mapId: PLAGE_ID, minGroups: 4 });
    expect(once.respawns).toBe(state.respawns + 1);
  });

  /**
   * Même état donc **mêmes candidates** : si les positions diffèrent, c'est la
   * graine qui les a départagées, pas la règle d'occupation (qui les empêcherait
   * de tomber sur la même case d'un groupe existant, mais pas sur la même case
   * libre d'un rang à l'autre).
   */
  it("change la position tirée quand le rang de graine change", () => {
    const state = seeded(PLAGE_ID);
    const drawnAt = (rank: number): Position | undefined => {
      const rng = createSeededRng(seedForRespawn(PLAGE_ID, rank));
      const next = respawnMonsterGroup({ state: { ...state, respawns: rank }, spawn: SPAWN, minGroups: 4, rng });
      return next.monsterGroups.at(-1)?.pos;
    };
    expect(drawnAt(0)).not.toEqual(drawnAt(1));
  });
});

describe("respawnMonsterGroup — carte saturée", () => {
  it("ne place rien, journalise et rend la main tout de suite", () => {
    const state = initExploration({ map: parseAsciiMap(["PM", ".."]), ...SPAWN });
    const next = respawnMonsterGroup({ state, spawn: SPAWN, minGroups: 3, rng: createSeededRng(7) });
    expect(next.monsterGroups).toHaveLength(state.monsterGroups.length);
    expect(next.log.join(" ")).toMatch(/caisses de morue/i);
  }, 1_000);

  it("ne mute jamais l'état d'entrée", () => {
    const state = seeded(PLAGE_ID);
    const snapshot = structuredClone(state);
    respawn(state, { mapId: PLAGE_ID, minGroups: 4 });
    expect(state).toEqual(snapshot);
  });
});

function explorationState(): ExplorationState {
  const { exploration } = useCombatStore.getState();
  if (exploration === null) throw new Error("exploration attendue");
  return exploration;
}

function firstGroup(): MonsterGroup {
  const group = explorationState().monsterGroups[0];
  if (group === undefined) throw new Error("groupe attendu");
  return group;
}

function startRun(): void {
  useGameStore.getState().resetGame();
  useGameStore.getState().createCharacter({ name: "Anselme", classId: "iop" });
  useCombatStore.getState().startExploration();
}

/** Engage le premier groupe puis force la phase : le respawn ne lit que l'état. */
function fakePhase(phase: "victory" | "defeat"): void {
  useCombatStore.getState().clickCell(firstGroup().pos);
  const { combat } = useCombatStore.getState();
  if (combat === null) throw new Error("combat attendu");
  useCombatStore.setState({ combat: { ...combat, phase }, rewards: REWARDS });
}

describe("store — respawn à la victoire d'exploration", () => {
  it("rend trois groupes à la carte après la victoire", () => {
    startRun();
    const group = firstGroup();
    fakePhase("victory");
    useCombatStore.getState().returnToMap();
    const back = useCombatStore.getState();
    expect(back.mode).toBe("exploration");
    expect(back.exploration?.monsterGroups).toHaveLength(3);
    expect(back.exploration?.monsterGroups.map((entry) => entry.id)).not.toContain(group.id);
  });

  it("rejoue exactement les mêmes positions sur deux parties", () => {
    const play = (): Position[] => {
      startRun();
      fakePhase("victory");
      useCombatStore.getState().returnToMap();
      return explorationState().monsterGroups.map((group) => group.pos);
    };
    expect(play()).toEqual(play());
  });
});

describe("store — garde du respawn", () => {
  it("n'autorise le respawn que sur une victoire hors donjon", () => {
    startRun();
    useCombatStore.getState().clickCell(firstGroup().pos);
    const run = { dungeonId: "donjon_test", roomIndex: 0, clearedRoomNumbers: [], keysConsumed: 1, log: [] };
    const combat = useCombatStore.getState().combat;
    if (combat === null) throw new Error("combat attendu");
    const victory = { ...combat, phase: "victory" as const };
    expect(canRespawnAfterVictory({ combat, dungeonRun: null })).toBe(false);
    expect(canRespawnAfterVictory({ combat: victory, dungeonRun: null })).toBe(true);
    expect(canRespawnAfterVictory({ combat: victory, dungeonRun: run })).toBe(false);
  });
});

describe("store — les gardes du respawn", () => {
  it("ne touche pas à l'exploration pendant le combat (identité)", () => {
    startRun();
    const before = explorationState();
    useCombatStore.getState().clickCell(firstGroup().pos);
    useCombatStore.getState().endTurn();
    expect(useCombatStore.getState().exploration).toBe(before);
    expect(explorationState().monsterGroups).toHaveLength(3);
  });

  it("ne fait rien réapparaître dans un donjon", () => {
    startRun();
    const group = firstGroup();
    fakePhase("victory");
    const run = { dungeonId: "donjon_test", roomIndex: 0, clearedRoomNumbers: [], keysConsumed: 1, log: [] };
    useCombatStore.setState({ dungeonRun: run });
    useCombatStore.getState().returnToMap();
    const ids = explorationState().monsterGroups.map((entry) => entry.id);
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain(group.id);
  });

  it("ne fait pas réapparaître après une défaite", () => {
    startRun();
    const before = explorationState().monsterGroups.map((entry) => entry.id);
    fakePhase("defeat");
    useCombatStore.getState().returnToMap();
    expect(explorationState().monsterGroups.map((entry) => entry.id)).toEqual(before);
  });
});
