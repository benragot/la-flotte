import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isWalkableCell, parseAsciiMap } from "../../src/engine/grid";
import type { DecorSpec } from "../../src/schemas/mapSchema";
import type { Shape } from "../../src/renderer/shapes";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { hashUnit } from "../../src/renderer/cellHash";
import type { DecorView } from "../../src/renderer/decor";
import { decorShapes } from "../../src/renderer/decor";
import { mapDecorSpecs } from "../../src/renderer/mapDecor";
import { buildSceneModel } from "../../src/renderer/scene";
import { sceneOrigin } from "../../src/renderer/gridProjection";
import { MATERIAL_KINDS, materialAt, waterTone } from "../../src/renderer/tileMaterials";
import { groundShapes, waterEdges } from "../../src/renderer/tileTexture";

const maps = parseMapsYaml(readFileSync(join(process.cwd(), "data", "maps.yaml"), "utf8"));
const beach = maps.find((map) => map.id === "ferraille_plage_01");
if (beach === undefined) throw new Error("plage absente");
const map = parseAsciiMap(beach.grid);
const ORIGIN = sceneOrigin({ width: map.width, height: map.height }, { width: 1024, height: 768 });
const EMPTY = { move: new Set<string>(), cast: new Set<string>(), hover: null };

const NO_NEIGHBOURS = { north: false, east: false, south: false, west: false };

describe("hash de case — motif déterministe", () => {
  it("renvoie toujours la même valeur pour la même case", () => {
    expect(hashUnit(3, 7)).toBe(hashUnit(3, 7));
    expect(hashUnit(3, 7)).not.toBe(hashUnit(7, 3));
  });

  it("reste dans [0, 1) et varie d'une case à l'autre", () => {
    const values = new Set<number>();
    for (let x = 0; x < 12; x += 1) {
      for (let y = 0; y < 12; y += 1) {
        const value = hashUnit(x, y);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
        values.add(value);
      }
    }
    expect(values.size).toBe(144);
  });
});

describe("matériaux de sol — la plage n'est plus un carré uni", () => {
  it("déduit sable, galets, eau, ponton et pierre", () => {
    expect(materialAt(".", false, false)).toBe("sable");
    expect(materialAt(".", true, false)).toBe("galets");
    expect(materialAt("~", false, false)).toBe("eau");
    expect(materialAt("#", false, false)).toBe("pierre");
    expect(materialAt(".", false, true)).toBe("ponton");
  });

  it("alterne deux tons d'eau selon la parité de la case", () => {
    expect(waterTone(0, 0)).not.toBe(waterTone(1, 0));
    expect(waterTone(1, 0)).toBe(waterTone(0, 1));
  });

  it("couvre les cinq matériaux sur la carte réelle", () => {
    const scene = buildSceneModel({ map, highlight: EMPTY, origin: ORIGIN });
    const materials = new Set(scene.tiles.map((tile) => tile.material));
    expect([...materials].sort()).toEqual([...MATERIAL_KINDS].sort());
    expect(MATERIAL_KINDS).toHaveLength(5);
  });
});

describe("textures de sol — formes procédurales", () => {
  it("produit des formes pour chaque matériau de sol", () => {
    const shapes = groundShapes({ material: "sable", x: 1, y: 2, center: { x: 100, y: 60 }, scale: 1 });
    expect(shapes.length).toBeGreaterThan(0);
    expect(shapes).toEqual(groundShapes({ material: "sable", x: 1, y: 2, center: { x: 100, y: 60 }, scale: 1 }));
  });

  it("trace l'écume uniquement sur les bords qui touchent la terre", () => {
    expect(waterEdges(NO_NEIGHBOURS)).toHaveLength(0);
    expect(waterEdges({ ...NO_NEIGHBOURS, north: true })).toEqual(["north"]);
    expect(waterEdges({ north: true, east: true, south: true, west: true })).toHaveLength(4);
  });

  it("ajoute un liseré d'écume à l'eau qui borde la plage", () => {
    const calm = groundShapes({ material: "eau", x: 2, y: 2, center: { x: 100, y: 60 }, scale: 1 });
    const shore = groundShapes({ material: "eau", x: 2, y: 2, center: { x: 100, y: 60 }, scale: 1, edges: ["north"] });
    expect(shore.length).toBeGreaterThan(calm.length);
  });
});

describe("décor — formes dessinées, aucun asset", () => {
  const view = (type: DecorSpec["type"]): DecorView => ({
    type,
    layer: "below",
    center: { x: 160, y: 120 },
    scale: 1,
  });

  it("dessine chaque type demandé avec au moins une forme", () => {
    const types: DecorSpec["type"][] = ["epave", "mat", "cordages", "baril", "caisse", "ancre", "chaine", "rocher", "algue", "debris"];
    types.forEach((type) => expect(decorShapes(view(type)).length, type).toBeGreaterThan(0));
  });

  it("donne exactement la même image pour le même objet", () => {
    expect(decorShapes(view("epave"))).toEqual(decorShapes(view("epave")));
  });

  function numbersOf(shape: Shape): number[] {
    if (shape.kind === "ellipse" || shape.kind === "ring") return [shape.x, shape.y, shape.rx, shape.ry];
    return shape.points;
  }

  it("ne produit que des nombres finis", () => {
    decorShapes(view("epave")).forEach((shape) => {
      numbersOf(shape).forEach((value) => expect(Number.isFinite(value)).toBe(true));
    });
  });
});

describe("scène de la plage — décor posé en données", () => {
  it("lit les objets de data/maps.yaml pour la carte rendue", () => {
    expect(mapDecorSpecs(map)).toHaveLength(beach.decor.length);
    expect(mapDecorSpecs(parseAsciiMap(["P..", "..M"]))).toEqual([]);
  });

  it("expose le décor dans le modèle de scène", () => {
    const scene = buildSceneModel({ map, highlight: EMPTY, origin: ORIGIN });
    expect(scene.decor).toHaveLength(beach.decor.length);
    expect(scene.decor.every((entry) => Number.isFinite(entry.center.x) && Number.isFinite(entry.center.y))).toBe(true);
  });

  it("donne deux fois le même modèle : aucun aléatoire non seedé", () => {
    expect(buildSceneModel({ map, highlight: EMPTY, origin: ORIGIN }))
      .toEqual(buildSceneModel({ map, highlight: EMPTY, origin: ORIGIN }));
  });

  it("porte à la fois les contours de cases (#75) et les 22 décors", () => {
    const scene = buildSceneModel({ map, highlight: EMPTY, origin: ORIGIN });
    const walkable = map.cells.flatMap((row, y) => row.map((cell, x) => ({ cell, position: { x, y } })));
    const count = walkable.filter((entry) => isWalkableCell(map, entry.position)).length;
    expect(scene.outlines).toHaveLength(count);
    expect(scene.outlines.every((outline) => outline.points.length === 8)).toBe(true);
    expect(scene.decor).toHaveLength(beach.decor.length);
  });

  it("attribue le matériau ponton aux cases de ponton de la grille", () => {
    const scene = buildSceneModel({ map, highlight: EMPTY, origin: ORIGIN });
    const pontoon = scene.tiles.filter((tile) => tile.material === "ponton");
    expect(pontoon).toHaveLength(4);
    expect(pontoon.map((tile) => `${tile.position.x}:${tile.position.y}`).sort()).toEqual(["0:8", "0:9", "1:8", "1:9"]);
  });

  it("texture chaque tuile de base sans perdre la sémantique de la grille", () => {
    const scene = buildSceneModel({ map, highlight: EMPTY, origin: ORIGIN });
    expect(scene.tiles).toHaveLength(144);
    expect(scene.tiles.filter((tile) => tile.cell === "~")).toHaveLength(25);
    scene.tiles.forEach((tile) => expect(tile.texture.length).toBeGreaterThan(0));
  });
});
