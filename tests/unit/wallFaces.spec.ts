import { describe, expect, it } from "vitest";
import type { Graphics } from "pixi.js";
import type { TileView } from "../../src/renderer/scene";
import { gridDiamond } from "../../src/renderer/gridProjection";
import { drawGrid } from "../../src/renderer/tilePaint";
import { WALL_HEIGHT, WALL_SIDE, WALL_SIDE_EAST, WALL_TOP } from "../../src/renderer/tileStyle";
import { wallFaces, wallTopPoints } from "../../src/renderer/wallFaces";

/** Les deux zooms réels du jeu : une géométrie qui n'en marche qu'un est fausse. */
const ZOOMS = [1.45, 2.19];

function wall(scale: number): TileView {
  const diamond = gridDiamond({ x: 2, y: 3, origin: { x: 320, y: 120, scale } });
  return {
    cell: "#",
    position: { x: 2, y: 3 },
    center: { x: diamond.cx, y: diamond.cy },
    points: diamond.points,
    scale,
    style: { fill: 0, alpha: 1, stroke: null, strokeAlpha: 0 },
    material: "pierre",
    texture: [],
  };
}

/** Sommets du losange : [haut, droite, bas, gauche] × [x, y]. */
const TOP = 0;
const RIGHT = 2;
const BOTTOM = 4;
const LEFT = 6;

function at(points: readonly number[], vertex: number): [number, number] {
  return [points[vertex] ?? 0, points[vertex + 1] ?? 0];
}

interface Recorder {
  graphics: Graphics;
  polys: number[][];
  fills: number[];
}

function recorder(): Recorder {
  const polys: number[][] = [];
  const fills: number[] = [];
  const poly = (points: number[]) => polys.push(points);
  const fill = (style: { color: number }) => fills.push(style.color);
  return { graphics: { poly, fill, stroke: () => undefined } as unknown as Graphics, polys, fills };
}

describe("mur — le dessus suit la hauteur du relief", () => {
  it.each(ZOOMS)("remonte le losange de WALL_HEIGHT × %s", (scale) => {
    const view = wall(scale);
    const top = wallTopPoints(view);
    expect(at(top, TOP)).toEqual([view.center.x, view.center.y - 16 * scale - WALL_HEIGHT * scale]);
    expect(at(top, LEFT)).toEqual([view.center.x - 32 * scale, view.center.y - WALL_HEIGHT * scale]);
  });
});

describe("mur — deux flancs, pas une feuille de papier", () => {
  it.each(ZOOMS)("la face sud-ouest garde l'arête gauche et la pointe basse (zoom %s)", (scale) => {
    const view = wall(scale);
    const [west] = wallFaces(view);
    expect(at(west?.points ?? [], 0)).toEqual(at(view.points, LEFT));
    expect(at(west?.points ?? [], 2)).toEqual(at(view.points, BOTTOM));
  });

  it.each(ZOOMS)("la face sud-est garde la pointe basse et l'arête droite (zoom %s)", (scale) => {
    const view = wall(scale);
    const east = wallFaces(view)[1];
    expect(at(east?.points ?? [], 0)).toEqual(at(view.points, BOTTOM));
    expect(at(east?.points ?? [], 2)).toEqual(at(view.points, RIGHT));
  });

  it("les deux flancs se rejoignent sur la même arête verticale, sous le centre", () => {
    const view = wall(1.45);
    const [west, east] = wallFaces(view);
    expect([west?.points[4], west?.points[5]]).toEqual([east?.points[6], east?.points[7]]);
    expect(west?.points[4]).toBe(view.center.x);
    expect(west?.points[5]).toBeCloseTo(view.center.y + 16 * 1.45 - WALL_HEIGHT * 1.45);
  });

  it("les deux flancs couvrent toute la largeur du losange, sans trou", () => {
    const view = wall(2.19);
    const [west, east] = wallFaces(view);
    expect(west?.points[0]).toBe(at(view.points, LEFT)[0]);
    expect(east?.points[2]).toBe(at(view.points, RIGHT)[0]);
    expect(west?.points[2]).toBe(east?.points[0]);
  });

  it("donne des teintes distinctes au dessus, au flanc ouest et au flanc est", () => {
    const colors = new Set([WALL_TOP, WALL_SIDE, WALL_SIDE_EAST]);
    expect(colors.size).toBe(3);
  });
});

describe("mur — la peinture remplit le socle puis les faces", () => {
  it("peint le losange au sol avant les deux flancs et le dessus", () => {
    const paint = recorder();
    drawGrid(paint.graphics, [wall(1.45)]);
    expect(paint.polys[0]).toEqual(wall(1.45).points);
    expect(paint.fills).toEqual([WALL_SIDE, WALL_SIDE, WALL_SIDE_EAST, WALL_TOP]);
  });

  it("ne peint aucune face pour une case de sol", () => {
    const paint = recorder();
    drawGrid(paint.graphics, [{ ...wall(1), cell: ".", material: "sable" }]);
    expect(paint.fills).not.toContain(WALL_TOP);
  });
});
