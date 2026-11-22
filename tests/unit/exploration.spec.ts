import { describe, expect, it } from "vitest";
import { parseAsciiMap } from "../../src/engine/grid";
import {
  getMonsterGroupAt,
  initExploration,
  moveHeroOnMap,
  respawnMonsterGroup,
} from "../../src/engine/exploration";

/** `ferraille_plage_01` recopiée en dur : ce module ne lit jamais de YAML. */
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

const MONSTER = { monsterId: "piou_mazoute", monsterName: "Piou Mazouté", level: 1 };

interface CountingRng {
  rng: () => number;
  calls: () => number;
}

function makeRng(value: number): CountingRng {
  let calls = 0;
  const rng = (): number => {
    calls += 1;
    return value;
  };
  return { rng, calls: () => calls };
}

function plage() {
  return parseAsciiMap(PLAGE_ROWS);
}

function freshState() {
  return initExploration({ map: plage(), ...MONSTER });
}

describe("initExploration", () => {
  it("place le héros sur le premier placement joueur", () => {
    expect(freshState().playerPos).toEqual({ x: 3, y: 3 });
  });

  it("place un groupe sur le premier placement monstre", () => {
    const state = freshState();
    expect(state.monsterGroups).toHaveLength(1);
    expect(state.monsterGroups[0]?.pos).toEqual({ x: 5, y: 9 });
  });

  it("identifie le groupe de façon déterministe", () => {
    const group = freshState().monsterGroups[0];
    expect(group?.id).toBe("group-1");
    expect(group?.monsterIds).toEqual(["piou_mazoute"]);
    expect(group?.totalLevel).toBe(1);
  });

  it("compose le label à partir des paramètres, sans donnée en dur", () => {
    expect(freshState().monsterGroups[0]?.label).toBe("Piou Mazouté · Niv. 1");
  });

  it("démarre avec un journal non vide", () => {
    expect(freshState().log.length).toBeGreaterThan(0);
  });

  it("refuse une carte sans placement joueur", () => {
    const map = parseAsciiMap(["..M.", "...."]);
    expect(() => initExploration({ map, ...MONSTER })).toThrow(/joueur/i);
  });

  it("refuse une carte sans placement monstre", () => {
    const map = parseAsciiMap(["..P.", "...."]);
    expect(() => initExploration({ map, ...MONSTER })).toThrow(/monstre/i);
  });
});

describe("moveHeroOnMap", () => {
  it("déplace le héros et journalise la distance", () => {
    const state = freshState();
    const result = moveHeroOnMap(state, { x: 4, y: 3 });
    expect(result.path).toHaveLength(2);
    expect(result.state.playerPos).toEqual({ x: 4, y: 3 });
    expect(result.state.log.at(-1)).toContain("1 case");
  });

  it("ignore la limite de PM hors combat", () => {
    const state = freshState();
    const result = moveHeroOnMap(state, { x: 11, y: 11 });
    expect(result.path.length).toBeGreaterThan(10);
    expect(result.state.playerPos).toEqual({ x: 11, y: 11 });
  });

  it("ne mute jamais l'état d'entrée", () => {
    const state = freshState();
    const snapshot = structuredClone(state);
    moveHeroOnMap(state, { x: 4, y: 3 });
    expect(state).toEqual(snapshot);
  });
});

describe("moveHeroOnMap — refus", () => {
  it("refuse un mur sans toucher l'état", () => {
    const state = freshState();
    const result = moveHeroOnMap(state, { x: 11, y: 3 });
    expect(result.state).toBe(state);
    expect(result.path).toEqual([]);
  });

  it("refuse l'eau sans toucher l'état", () => {
    const state = freshState();
    const result = moveHeroOnMap(state, { x: 0, y: 0 });
    expect(result.state).toBe(state);
    expect(result.path).toEqual([]);
  });

  it("refuse la case occupée par un groupe", () => {
    const state = freshState();
    const result = moveHeroOnMap(state, { x: 5, y: 9 });
    expect(result.state).toBe(state);
    expect(result.path).toEqual([]);
  });
});

describe("getMonsterGroupAt", () => {
  it("retrouve le groupe sur sa case", () => {
    const state = freshState();
    expect(getMonsterGroupAt(state, { x: 5, y: 9 })?.id).toBe("group-1");
  });

  it("renvoie null sur une case vide", () => {
    expect(getMonsterGroupAt(freshState(), { x: 3, y: 4 })).toBeNull();
  });

  it("renvoie null hors de la carte", () => {
    expect(getMonsterGroupAt(freshState(), { x: 99, y: 99 })).toBeNull();
  });
});

describe("respawnMonsterGroup — placement", () => {
  it("place le nouveau groupe à distance de Manhattan au moins 4", () => {
    const state = freshState();
    const group = respawnMonsterGroup(state, () => 0.5).monsterGroups.at(-1);
    const distance = Math.abs((group?.pos.x ?? 0) - 3) + Math.abs((group?.pos.y ?? 0) - 3);
    expect(distance).toBeGreaterThanOrEqual(4);
  });

  it("place le nouveau groupe sur une case marchable et libre", () => {
    const state = freshState();
    const next = respawnMonsterGroup(state, () => 0.25);
    const pos = next.monsterGroups.at(-1)?.pos ?? { x: -1, y: -1 };
    expect(state.map.cells[pos.y]?.[pos.x]).not.toBe("#");
    expect(state.map.cells[pos.y]?.[pos.x]).not.toBe("~");
    const occupied = next.monsterGroups.slice(0, -1).some((g) => g.pos.x === pos.x);
    expect(occupied).toBe(false);
  });
});

describe("respawnMonsterGroup — déterminisme", () => {
  it("n'appelle le rng qu'une seule fois", () => {
    const counter = makeRng(0.5);
    respawnMonsterGroup(freshState(), counter.rng);
    expect(counter.calls()).toBe(1);
  });

  it("choisit la première candidate avec un rng à zéro", () => {
    const next = respawnMonsterGroup(freshState(), () => 0);
    expect(next.monsterGroups.at(-1)?.pos).toEqual({ x: 8, y: 0 });
  });

  it("choisit la dernière candidate avec un rng proche de 1", () => {
    const next = respawnMonsterGroup(freshState(), () => 0.999);
    expect(next.monsterGroups.at(-1)?.pos).toEqual({ x: 11, y: 11 });
  });

  it("conserve l'ordre déterministe des candidates", () => {
    const first = respawnMonsterGroup(freshState(), () => 0).monsterGroups.at(-1)?.pos;
    const second = respawnMonsterGroup(freshState(), () => 0).monsterGroups.at(-1)?.pos;
    expect(first).toEqual(second);
  });
});

describe("respawnMonsterGroup — invariants", () => {
  it("incrémente l'identifiant du groupe", () => {
    const next = respawnMonsterGroup(freshState(), () => 0.5);
    expect(next.monsterGroups.at(-1)?.id).toBe("group-2");
    expect(next.monsterGroups.map((group) => group.id)).toEqual(["group-1", "group-2"]);
  });

  it("renvoie l'état inchangé quand la carte est saturée", () => {
    const map = parseAsciiMap(["PM", ".."]);
    const state = initExploration({ map, ...MONSTER });
    const counter = makeRng(0);
    expect(respawnMonsterGroup(state, counter.rng)).toBe(state);
    expect(counter.calls()).toBe(0);
  });

  it("ne mute jamais l'état d'entrée", () => {
    const state = freshState();
    const snapshot = structuredClone(state);
    respawnMonsterGroup(state, () => 0.5);
    expect(state).toEqual(snapshot);
  });
});
