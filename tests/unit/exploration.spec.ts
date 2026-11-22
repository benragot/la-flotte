import { describe, expect, it } from "vitest";
import { isWalkableCell, parseAsciiMap, samePosition } from "../../src/engine/grid";
import type { ExplorationState } from "../../src/engine/exploration";
import {
  defeatGroup,
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

const SPAWN = { monsterId: "piou_mazoute", monsterName: "Piou Mazouté", level: 1 };
const RNG_STEPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.99];

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

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function plage(): ReturnType<typeof parseAsciiMap> {
  return parseAsciiMap(PLAGE_ROWS);
}

function freshState(): ExplorationState {
  return initExploration({ map: plage(), ...SPAWN });
}

function respawnAt(state: ExplorationState, rng: () => number): ExplorationState {
  return respawnMonsterGroup({ state, spawn: SPAWN, rng });
}

function newGroup(state: ExplorationState): ExplorationState["monsterGroups"][number] {
  return state.monsterGroups[state.monsterGroups.length - 1] ?? {
    id: "",
    pos: { x: -1, y: -1 },
    monsterIds: [],
    totalLevel: 0,
    label: "",
  };
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
    expect(() => initExploration({ map, ...SPAWN })).toThrow(/joueur/i);
  });

  // Depuis la donnée `groups`, l'absence de `M` n'est plus une carte vide : le
  // placement vient des cases libres de la grille, le vivier de spawns.yaml.
  it("pose un groupe même sans placement monstre : il vient des spawns", () => {
    const map = parseAsciiMap(["..P.", "...."]);
    const [group] = initExploration({ map, ...SPAWN }).monsterGroups;
    expect(group?.monsterIds).toEqual(["piou_mazoute"]);
    expect(group?.pos).not.toEqual({ x: 2, y: 0 });
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

describe("respawnMonsterGroup — ajout", () => {
  it("ajoute réellement un groupe et renvoie un nouvel état", () => {
    const state = freshState();
    const next = respawnAt(state, () => 0.5);
    expect(next).not.toBe(state);
    expect(next.monsterGroups).toHaveLength(2);
    expect(next.monsterGroups[1]?.id).toBe("group-2");
    expect(next.log.length).toBe(state.log.length + 1);
  });

  it("tire label et niveau du spawn fourni, pas d'un groupe existant", () => {
    const spawn = { monsterId: "craqueleur", monsterName: "Craqueleur", level: 7 };
    const next = respawnMonsterGroup({ state: freshState(), spawn, rng: () => 0 });
    const group = newGroup(next);
    expect(group.label).toBe("Craqueleur · Niv. 7");
    expect(group.totalLevel).toBe(7);
    expect(group.monsterIds).toEqual(["craqueleur"]);
  });

  it("ne partage pas le tableau d'ids entre deux groupes", () => {
    const next = respawnAt(freshState(), () => 0.5);
    const [first, second] = next.monsterGroups;
    expect(first?.monsterIds).not.toBe(second?.monsterIds);
    first?.monsterIds.push("pirate");
    expect(second?.monsterIds).toEqual(["piou_mazoute"]);
  });
});

describe("respawnMonsterGroup — placement", () => {
  it("garde les invariants sur onze tirages", () => {
    const state = freshState();
    const occupied = state.monsterGroups.map((group) => group.pos);
    RNG_STEPS.forEach((step) => {
      const pos = newGroup(respawnAt(state, () => step)).pos;
      expect(isWalkableCell(state.map, pos)).toBe(true);
      expect(occupied.some((cell) => samePosition(cell, pos))).toBe(false);
      expect(manhattan(pos, state.playerPos)).toBeGreaterThanOrEqual(4);
    });
  });

  it("ne réapparaît pas sur la case d'un groupe éloigné", () => {
    const state = initExploration({ map: parseAsciiMap(["P...M"]), ...SPAWN });
    expect(respawnAt(state, () => 0)).toBe(state);
  });

  it("écarte une case occupée pour préférer la case libre", () => {
    const state = initExploration({ map: parseAsciiMap(["P...M."]), ...SPAWN });
    expect(newGroup(respawnAt(state, () => 0)).pos).toEqual({ x: 5, y: 0 });
  });

  it("renvoie la même référence si seule une case bloquée est candidate", () => {
    const state = initExploration({ map: parseAsciiMap(["P..M#"]), ...SPAWN });
    expect(respawnAt(state, () => 0)).toBe(state);
  });
});

describe("respawnMonsterGroup — déterminisme", () => {
  it("n'appelle le rng qu'une seule fois", () => {
    const counter = makeRng(0.5);
    respawnAt(freshState(), counter.rng);
    expect(counter.calls()).toBe(1);
  });

  it("choisit la première candidate avec un rng à zéro", () => {
    expect(newGroup(respawnAt(freshState(), () => 0)).pos).toEqual({ x: 8, y: 0 });
  });

  it("choisit la dernière candidate avec un rng proche de 1", () => {
    expect(newGroup(respawnAt(freshState(), () => 0.999)).pos).toEqual({ x: 11, y: 11 });
  });

  it("conserve l'ordre déterministe des candidates", () => {
    const first = newGroup(respawnAt(freshState(), () => 0)).pos;
    const second = newGroup(respawnAt(freshState(), () => 0)).pos;
    expect(first).toEqual(second);
  });
});

describe("respawnMonsterGroup — carte saturée", () => {
  it("renvoie l'état inchangé quand aucune candidate n'existe", () => {
    const state = initExploration({ map: parseAsciiMap(["PM", ".."]), ...SPAWN });
    const counter = makeRng(0);
    expect(respawnMonsterGroup({ state, spawn: SPAWN, rng: counter.rng })).toBe(state);
    expect(counter.calls()).toBe(0);
  });

  it("ne mute jamais l'état d'entrée", () => {
    const state = freshState();
    const snapshot = structuredClone(state);
    respawnAt(state, () => 0.5);
    expect(state).toEqual(snapshot);
  });
});

describe("respawnMonsterGroup — sans groupe existant", () => {
  it("respawn après une victoire, quand la carte est vide", () => {
    const state = defeatGroup(freshState(), "group-1");
    const next = respawnAt(state, () => 0);
    expect(next.monsterGroups).toHaveLength(1);
    expect(next.monsterGroups[0]?.id).toBe("group-2");
    expect(newGroup(next).pos).toEqual({ x: 8, y: 0 });
  });

  it("repart de group-1 sans aucun historique", () => {
    const bare = { ...freshState(), monsterGroups: [], log: [] };
    expect(newGroup(respawnAt(bare, () => 0)).id).toBe("group-1");
  });

  it("incrémente encore l'id après deux victoires", () => {
    const once = defeatGroup(freshState(), "group-1");
    const respawned = respawnAt(once, () => 0);
    const twice = defeatGroup(respawned, "group-2");
    expect(newGroup(respawnAt(twice, () => 0)).id).toBe("group-3");
  });
});

describe("defeatGroup", () => {
  it("retire le groupe vaincu et journalise son id", () => {
    const state = freshState();
    const next = defeatGroup(state, "group-1");
    expect(next.monsterGroups).toEqual([]);
    expect(next.log.length).toBe(state.log.length + 1);
    expect(next.log.at(-1)).toContain("group-1");
  });

  it("renvoie la même référence pour un id inconnu", () => {
    const state = freshState();
    expect(defeatGroup(state, "group-42")).toBe(state);
  });

  it("ne mute jamais l'état d'entrée", () => {
    const state = freshState();
    const snapshot = structuredClone(state);
    defeatGroup(state, "group-1");
    expect(state).toEqual(snapshot);
  });
});
