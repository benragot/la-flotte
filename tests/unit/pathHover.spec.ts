import { describe, expect, it } from "vitest";
import { getActiveCombatant } from "../../src/engine/combatLoop/active";
import { initCombat } from "../../src/engine/combatLoop/init";
import type { CombatState } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import { pathCost, parseAsciiMap } from "../../src/engine/grid";
import type { AsciiMap, Position } from "../../src/engine/grid";
import { buildExplorationViewModel } from "../../src/renderer/explorationScene";
import type { ViewModel } from "../../src/renderer/combatSceneModel";
import { buildViewModel } from "../../src/renderer/combatSceneModel";
import { hoverPathPreview } from "../../src/renderer/pathPreview";
import { PATH_ALPHA, PATH_HIGHLIGHT } from "../../src/renderer/tileStyle";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (file: string): string => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));

const VIEWPORT = { width: 1024, height: 768 };

/** Grille nue 5×5 : aucun relief ne fausse la facture DEC-10. */
const OPEN_ROWS = [".....", ".....", ".....", ".....", "....."];

/** Grille 8×8 avec un mur vertical (x=6, y=1..3) et une flaque (x=4..5, y=5). */
const RELIEF_ROWS = [
  "........",
  "......#.",
  "......#.",
  "......#.",
  "........",
  "....~~..",
  "........",
  "........",
];

const OPEN: AsciiMap = parseAsciiMap(OPEN_ROWS);
const RELIEF: AsciiMap = parseAsciiMap(RELIEF_ROWS);

function preview(map: AsciiMap, to: Position, maxPm: number, occupied?: Position[]) {
  return hoverPathPreview({ map, from: { x: 0, y: 0 }, to, maxPm, occupied });
}

describe("hoverPathPreview — facture DEC-10 du chemin survolé", () => {
  it("chemin droit : une case par pas, 1 PM par pas orthogonal", () => {
    const hover = preview(OPEN, { x: 3, y: 0 }, 6);
    expect(hover.payable).toBe(true);
    expect(hover.blockedBy).toBeNull();
    expect(hover.cost).toBe(3);
    expect(hover.path).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]);
  });

  it("diagonale : un seul pas, mais 2 PM (DEC-10)", () => {
    const hover = preview(OPEN, { x: 1, y: 1 }, 2);
    expect(hover.payable).toBe(true);
    expect(hover.cost).toBe(2);
    expect(hover.path).toHaveLength(2);
  });

  it("hors budget : aucun chemin à peindre, mais le coût reste affichable", () => {
    const hover = preview(OPEN, { x: 3, y: 0 }, 2);
    expect(hover.payable).toBe(false);
    expect(hover.blockedBy).toBe("range");
    expect(hover.cost).toBe(3);
    expect(hover.path).toEqual([]);
  });

  it("budget nul : la moindre case coûte 1 PM et n'est pas payable", () => {
    const hover = preview(OPEN, { x: 1, y: 0 }, 0);
    expect(hover.payable).toBe(false);
    expect(hover.cost).toBe(1);
    expect(hover.path).toEqual([]);
  });

  it("case = position courante : un chemin d'une case, coût nul, payable", () => {
    const hover = preview(OPEN, { x: 0, y: 0 }, 3);
    expect(hover.payable).toBe(true);
    expect(hover.cost).toBe(0);
    expect(hover.path).toEqual([{ x: 0, y: 0 }]);
  });
});

describe("hoverPathPreview — cibles refusées par le terrain", () => {
  it("mur : aucun chemin, coût nul, motif mur", () => {
    const hover = preview(RELIEF, { x: 6, y: 2 }, 12);
    expect(hover.path).toEqual([]);
    expect(hover.cost).toBe(0);
    expect(hover.blockedBy).toBe("wall");
  });

  it("eau : aucun chemin, motif eau", () => {
    expect(preview(RELIEF, { x: 4, y: 5 }, 12).blockedBy).toBe("water");
  });

  it("case occupée : l'occupation prime sur le terrain", () => {
    const hover = preview(RELIEF, { x: 6, y: 2 }, 12, [{ x: 6, y: 2 }]);
    expect(hover.blockedBy).toBe("occupied");
    expect(hover.path).toEqual([]);
  });
});

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`introuvable: ${id}`);
  return found;
}

/** 5×5 ouverte : héros (2,1) à 3 PM, monstre (4,4) à 4 PM (même fixture que la zone PM). */
const ARENA = [".....", "..P..", ".....", ".....", "....M"];

function buildCombat(): CombatState {
  return initCombat({
    map: parseAsciiMap([...ARENA]),
    hero: createHero("Balthazar", mustFind(classes, "iop")),
    monster: mustFind(monsters, "piou_mazoute"),
    spells,
  });
}

function viewAt(hoveredCell: Position | null, combat: CombatState = buildCombat()): ViewModel {
  return buildViewModel({ combat, selectedSpellId: null, hoveredCell, viewport: VIEWPORT });
}

function pathKeys(view: ViewModel): string[] {
  return view.path.map((tile) => `${tile.position.x}:${tile.position.y}`);
}

describe("buildViewModel — le chemin survolé devient une couche peinte", () => {
  it("survol d'une case à 1 PM : deux cases peintes, du héros jusqu'à la cible", () => {
    const combat = buildCombat();
    expect(combat.player.mp).toBe(3);
    const view = viewAt({ x: 2, y: 0 }, combat);
    expect(pathKeys(view)).toEqual(["2:1", "2:0"]);
    expect(view.pathHint?.cost).toBe(1);
    expect(view.pathHint?.payable).toBe(true);
    expect(view.pathHint?.target.position).toEqual({ x: 2, y: 0 });
  });

  it("le coût affiché est la facture du moteur, pas un nombre de cases", () => {
    const view = viewAt({ x: 1, y: 0 });
    expect(view.pathHint?.cost).toBe(2);
    expect(view.path).toHaveLength(2);
    expect(pathCost(view.path.map((tile) => tile.position))).toBe(2);
  });

  it("les cases du chemin portent le style de la spec §3.2", () => {
    const view = viewAt({ x: 2, y: 0 });
    view.path.forEach((tile) => {
      expect(tile.style.fill).toBe(PATH_HIGHLIGHT);
      expect(tile.style.alpha).toBe(PATH_ALPHA);
      expect(tile.style.stroke).toBeNull();
    });
  });

  it("hors budget : aucune case peinte, mais le coût et l'état non payable", () => {
    const view = viewAt({ x: 0, y: 4 });
    expect(view.path).toEqual([]);
    expect(view.pathHint?.cost).toBe(5);
    expect(view.pathHint?.payable).toBe(false);
    expect(view.pathHint?.target.position).toEqual({ x: 0, y: 4 });
  });
});

describe("buildViewModel — aucun chemin hors survol, hors tour ou sur une cible refusée", () => {
  it("sans survol : rien", () => {
    const view = viewAt(null);
    expect(view.path).toEqual([]);
    expect(view.pathHint).toBeNull();
  });

  it("survol de la case du héros : rien à peindre, rien à annoncer", () => {
    const view = viewAt({ x: 2, y: 1 });
    expect(view.path).toEqual([]);
    expect(view.pathHint).toBeNull();
  });

  it("pendant le tour ennemi : le héros ne joue pas, aucun aperçu", () => {
    const enemyTurn: CombatState = { ...buildCombat(), phase: "enemy_turn" };
    const view = viewAt({ x: 2, y: 0 }, enemyTurn);
    expect(view.path).toEqual([]);
    expect(view.pathHint).toBeNull();
    expect(getActiveCombatant(enemyTurn).kind).toBe("enemy");
  });

  it("survol du monstre : case occupée, aucun chemin", () => {
    const view = viewAt({ x: 4, y: 4 });
    expect(view.path).toEqual([]);
    expect(view.pathHint).toBeNull();
  });
});

describe("exploration — décision gelée : aucun aperçu de chemin", () => {
  it("garde `path` vide sans survol, comme le fige `explorationUi.spec.ts`", () => {
    const exploration = { playerPos: { x: 0, y: 0 }, groups: [], map: OPEN };
    expect(buildExplorationViewModel({ exploration, viewport: VIEWPORT }).path).toEqual([]);
  });
});
