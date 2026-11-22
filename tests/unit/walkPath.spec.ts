import { describe, expect, it } from "vitest";
import type { Position } from "../../src/engine/grid";
import type { GridOutline, TileView } from "../../src/renderer/scene";
import { WALK_MS_PER_CELL } from "../../src/renderer/sprites/walkMotion";
import { findWalkPath, walkField, walkPlanAlong } from "../../src/renderer/sprites/walkPath";

/**
 * Le chemin suivi est recalculé côté rendu, sur les **cases praticables** de la
 * scène : un trajet logique de 3 cases ne doit jamais être peint en diagonale à
 * travers le mur qu'il contourne.
 */
function cellsOf(width: number, height: number, blocked: readonly Position[] = []): Position[] {
  const blockedKeys = new Set(blocked.map(key));
  return Array.from({ length: width * height }, (_, index) => ({ x: index % width, y: Math.floor(index / width) })).filter(
    (cell) => !blockedKeys.has(key(cell)),
  );
}

function key(cell: Position): string {
  return `${cell.x}:${cell.y}`;
}

function tile(cell: Position): TileView {
  return { position: cell, center: { x: cell.x * 64, y: cell.y * 32 } } as unknown as TileView;
}

function outline(cell: Position): GridOutline {
  return { cell } as unknown as GridOutline;
}

function field(width: number, height: number, blocked: readonly Position[] = []) {
  const cells = cellsOf(width, height, blocked);
  return walkField(cells.map(tile), cells.map(outline));
}

describe("walkField — les cases praticables et leurs centres", () => {
  it("ne garde que les cases portées par un contour praticable", () => {
    const tiles = [tile({ x: 0, y: 0 }), tile({ x: 1, y: 0 })];
    const map = walkField(tiles, [outline({ x: 1, y: 0 })]);
    expect([...map.keys()]).toEqual(["1:0"]);
    expect(map.get("1:0")).toEqual({ x: 64, y: 0 });
  });
});

describe("findWalkPath — un chemin orthogonal dans les cases praticables", () => {
  const WALL = { x: 1, y: 1 };

  it("contourne le mur au lieu de le traverser", () => {
    const path = findWalkPath(field(3, 3, [WALL]), { x: 0, y: 1 }, { x: 2, y: 1 });
    expect(path).not.toBeNull();
    const cells = path ?? [];
    expect(cells[0]).toEqual({ x: 0, y: 1 });
    expect(cells[cells.length - 1]).toEqual({ x: 2, y: 1 });
    expect(cells.length).toBe(5);
    expect(cells.map(key)).not.toContain(key(WALL));
  });

  it("n'avance que d'une case par étape, jamais en diagonale", () => {
    const cells = findWalkPath(field(4, 4), { x: 0, y: 0 }, { x: 3, y: 3 }) ?? [];
    cells.slice(1).forEach((cell, index) => {
      const previous = cells[index]!;
      expect(Math.abs(cell.x - previous.x) + Math.abs(cell.y - previous.y)).toBe(1);
    });
  });

  it("renvoie null quand aucune case praticable ne mène à destination", () => {
    const pen = [
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 0 },
    ];
    expect(findWalkPath(field(3, 3, pen), { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
  });

  it("une même case ne demande aucun trajet", () => {
    expect(findWalkPath(field(2, 2), { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([{ x: 1, y: 1 }]);
  });
});

describe("walkPlanAlong — un segment peint par case", () => {
  it("transforme chaque case du chemin en point, dans l'ordre", () => {
    const map = field(3, 2);
    const plan = walkPlanAlong(map, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(plan?.points).toEqual([
      { x: 0, y: 0 },
      { x: 64, y: 0 },
      { x: 64, y: 32 },
    ]);
    expect(plan?.durationMs).toBe(2 * WALK_MS_PER_CELL);
  });

  it("refuse un trajet d'une case ou sans centre connu", () => {
    const map = field(2, 2);
    expect(walkPlanAlong(map, [{ x: 0, y: 0 }])).toBeNull();
    expect(walkPlanAlong(map, [{ x: 0, y: 0 }, { x: 9, y: 9 }])).toBeNull();
  });
});
