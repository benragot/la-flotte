import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSightBlocking,
  isWalkable,
  parseAsciiMap,
} from "../../src/engine/grid/asciiMap";
import { hasLineOfSight } from "../../src/engine/grid/lineOfSight";
import { findPath } from "../../src/engine/grid/pathfinding";
import { mapSchema, parseMapsYaml } from "../../src/schemas/mapSchema";

const ISLAND = ["P..#", ".#..", "..M~", "~~~."];
const OPEN = [".....", ".....", ".....", ".....", "....."];

describe("parseAsciiMap", () => {
  const map = parseAsciiMap(ISLAND);

  it("lit les dimensions de la grille", () => {
    expect(map.width).toBe(4);
    expect(map.height).toBe(4);
  });

  it("extrait les placements joueur et monstre", () => {
    expect(map.playerSpawns).toEqual([{ x: 0, y: 0 }]);
    expect(map.monsterSpawns).toEqual([{ x: 2, y: 2 }]);
  });

  it("convertit chaque caractère en type de cellule", () => {
    expect(map.cells[0]?.[3]).toBe("#");
    expect(map.cells[3]?.[0]).toBe("~");
  });
});

describe("légende des cellules", () => {
  it("rend le sol et les placements praticables", () => {
    expect(isWalkable(".")).toBe(true);
    expect(isWalkable("P")).toBe(true);
    expect(isWalkable("M")).toBe(true);
  });

  it("bloque le mouvement sur les murs et l'eau", () => {
    expect(isWalkable("#")).toBe(false);
    expect(isWalkable("~")).toBe(false);
  });

  it("ne bloque la ligne de vue que sur les murs", () => {
    expect(isSightBlocking("#")).toBe(true);
    expect(isSightBlocking("~")).toBe(false);
    expect(isSightBlocking(".")).toBe(false);
  });
});

const VALID_MAP = {
  id: "ile_test",
  name: "Île de test",
  width: 4,
  height: 2,
  grid: ["P...", "..M."],
};

describe("mapSchema", () => {
  it("accepte une grille valide", () => {
    expect(mapSchema.safeParse(VALID_MAP).success).toBe(true);
  });

  it("rejette une ligne de mauvaise largeur", () => {
    const grid = ["P...", "..M"];
    expect(mapSchema.safeParse({ ...VALID_MAP, grid }).success).toBe(false);
  });

  it("rejette une grille sans monstre", () => {
    const grid = ["P...", "...."];
    expect(mapSchema.safeParse({ ...VALID_MAP, grid }).success).toBe(false);
  });

  it("rejette un caractère inconnu", () => {
    const grid = ["P..X", "..M."];
    expect(mapSchema.safeParse({ ...VALID_MAP, grid }).success).toBe(false);
  });

  it("rejette un identifiant hors snake_case", () => {
    expect(mapSchema.safeParse({ ...VALID_MAP, id: "Île-Test" }).success).toBe(false);
  });
});

describe("findPath", () => {
  it("trouve le chemin direct sur sol libre", () => {
    const map = parseAsciiMap(OPEN);
    const path = findPath({ map, from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, maxPm: 5 });
    expect(path).toHaveLength(3);
    expect(path?.[0]).toEqual({ x: 0, y: 0 });
    expect(path?.[2]).toEqual({ x: 2, y: 0 });
  });

  it("contourne un mur", () => {
    const map = parseAsciiMap(["..#..", "..#..", ".....", "..#..", "..#.."]);
    const path = findPath({ map, from: { x: 0, y: 0 }, to: { x: 4, y: 0 }, maxPm: 12 });
    expect(path).toHaveLength(9);
    expect(path?.some((cell) => cell.x === 2 && cell.y === 0)).toBe(false);
  });

  it("ne traverse jamais l'eau", () => {
    const map = parseAsciiMap(["..~.."]);
    expect(findPath({ map, from: { x: 0, y: 0 }, to: { x: 4, y: 0 }, maxPm: 9 })).toBeNull();
  });

  it("contourne une cellule occupée", () => {
    const map = parseAsciiMap(OPEN);
    const occupied = [{ x: 0, y: 1 }];
    const path = findPath({ map, from: { x: 0, y: 0 }, to: { x: 0, y: 2 }, maxPm: 6, occupied });
    expect(path).toHaveLength(5);
    expect(path?.some((cell) => cell.x === 0 && cell.y === 1)).toBe(false);
  });

  it("renvoie null quand les PM sont insuffisants", () => {
    const map = parseAsciiMap(OPEN);
    expect(findPath({ map, from: { x: 0, y: 0 }, to: { x: 4, y: 0 }, maxPm: 3 })).toBeNull();
  });

  it("renvoie la case de départ quand from et to coïncident", () => {
    const map = parseAsciiMap(OPEN);
    const same = findPath({ map, from: { x: 1, y: 1 }, to: { x: 1, y: 1 }, maxPm: 0 });
    expect(same).toEqual([{ x: 1, y: 1 }]);
  });
});

describe("hasLineOfSight", () => {
  it("voit à travers un couloir dégagé", () => {
    const map = parseAsciiMap(OPEN);
    expect(hasLineOfSight({ map, from: { x: 0, y: 0 }, to: { x: 4, y: 0 } })).toBe(true);
  });

  it("est bloquée par un mur interposé", () => {
    const map = parseAsciiMap([".....", "..#..", "....."]);
    expect(hasLineOfSight({ map, from: { x: 2, y: 0 }, to: { x: 2, y: 2 } })).toBe(false);
  });

  it("traverse l'eau", () => {
    const map = parseAsciiMap([".....", "..~..", "....."]);
    expect(hasLineOfSight({ map, from: { x: 2, y: 0 }, to: { x: 2, y: 2 } })).toBe(true);
  });

  it("est bloquée par une entité interposée", () => {
    const map = parseAsciiMap(OPEN);
    const blockers = [{ x: 2, y: 0 }];
    expect(hasLineOfSight({ map, from: { x: 0, y: 0 }, to: { x: 4, y: 0 }, blockers })).toBe(false);
  });

  it("laisse passer une ligne au-dessus de l'eau", () => {
    const map = parseAsciiMap(["~~~~~", "~~~~~"]);
    expect(hasLineOfSight({ map, from: { x: 0, y: 0 }, to: { x: 4, y: 1 } })).toBe(true);
  });

  it("accepte une diagonale parfaite sans cellule intermédiaire", () => {
    const map = parseAsciiMap(["P#", "#M"]);
    expect(hasLineOfSight({ map, from: { x: 0, y: 0 }, to: { x: 1, y: 1 } })).toBe(true);
  });
});

describe("data/maps.yaml", () => {
  const raw = readFileSync(join(process.cwd(), "data", "maps.yaml"), "utf8");
  const maps = parseMapsYaml(raw);

  it("contient la plage de la Ferraille en 12x12", () => {
    const plage = maps.find((map) => map.id === "ferraille_plage_01");
    expect(plage, "ferraille_plage_01 absente").toBeDefined();
    expect(plage?.width).toBe(12);
    expect(plage?.height).toBe(12);
  });

  it("relie le placement joueur au placement monstre", () => {
    const grid = maps.find((map) => map.id === "ferraille_plage_01")?.grid ?? [];
    const map = parseAsciiMap(grid);
    expect(map.playerSpawns.length).toBeGreaterThan(0);
    expect(map.monsterSpawns.length).toBeGreaterThan(0);
    const from = map.playerSpawns[0] ?? { x: 0, y: 0 };
    const to = map.monsterSpawns[0] ?? from;
    expect(findPath({ map, from, to, maxPm: 64 })).not.toBeNull();
  });
});
