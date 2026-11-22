import { beforeEach, describe, expect, it } from "vitest";
import { initExploration } from "../../src/engine/exploration";
import type { ExplorationState } from "../../src/engine/exploration";
import { parseAsciiMap } from "../../src/engine/grid";
import type { Position } from "../../src/engine/grid";
import { BLOCKED_MOVE_LOG, useCombatStore } from "../../src/store/useCombatStore";

/**
 * Le clic d'exploration fonctionne (#51 l'a conservé) mais il était **muet** :
 * viser un mur, de l'eau ou une case hors carte ne produisait rien du tout.
 * Le joueur en conclut « on peut pas bouger ». Ces tests fixent le retour.
 * `ferraille_plage_01` recopiée en dur : ce module ne lit aucun YAML.
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
const SPAWN = { monsterId: "piou_mazoute", monsterName: "Piou Mazouté", level: 1 };
const HERO = { x: 3, y: 3 };
const FREE = { x: 5, y: 3 };
const WALL = { x: 6, y: 4 };
const WATER = { x: 0, y: 0 };

function explorationState(): ExplorationState {
  return initExploration({ map: parseAsciiMap(PLAGE_ROWS), ...SPAWN });
}

function startAtHero(): void {
  useCombatStore.setState({ mode: "exploration", exploration: explorationState(), combat: null, hoveredCell: null });
}

function heroPos(): Position | undefined {
  return useCombatStore.getState().exploration?.playerPos;
}

function log(): readonly string[] {
  return useCombatStore.getState().exploration?.log ?? [];
}

function click(cell: Position): void {
  useCombatStore.getState().clickCell(cell);
}

describe("clic d'exploration — une case libre déplace le héros", () => {
  beforeEach(startAtHero);

  it("déplace le héros sur la case cliquée, sans message de blocage", () => {
    click(FREE);
    expect(heroPos()).toEqual(FREE);
    expect(log()).not.toContain(BLOCKED_MOVE_LOG);
  });
});

describe("clic d'exploration — une case bloquée parle au joueur", () => {
  beforeEach(startAtHero);

  it("garde le héros sur place et écrit le blocage dans le journal (mur)", () => {
    click(WALL);
    expect(heroPos()).toEqual(HERO);
    expect(log().at(-1)).toBe(BLOCKED_MOVE_LOG);
  });

  it("traite l'eau comme un mur : même blocage, même message", () => {
    click(WATER);
    expect(heroPos()).toEqual(HERO);
    expect(log().at(-1)).toBe(BLOCKED_MOVE_LOG);
  });

  it("n'empile pas le message quand le joueur insiste sur la même case", () => {
    click(WALL);
    click(WALL);
    expect(log().filter((line) => line === BLOCKED_MOVE_LOG)).toHaveLength(1);
  });

  it("laisse le message réapparaître après un déplacement réussi", () => {
    click(WALL);
    click(FREE);
    click(WALL);
    expect(log().filter((line) => line === BLOCKED_MOVE_LOG)).toHaveLength(2);
  });

  it("ne touche pas au journal quand la case est libre", () => {
    const before = log().length;
    click(FREE);
    expect(log()).toHaveLength(before + 1);
    expect(log().at(-1)).toBe("Le héros se déplace de 2 case(s).");
  });
});
