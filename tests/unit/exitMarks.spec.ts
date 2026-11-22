import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AsciiMap, Position } from "../../src/engine/grid";
import { parseAsciiMap } from "../../src/engine/grid";
import type { MapDef } from "../../src/schemas/mapSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { EXIT_MARK_FILL, EXIT_MARK_RATIO, exitMarkDiamond } from "../../src/renderer/exitMarks";
import type { IsoOrigin } from "../../src/renderer/gridProjection";
import { TILE_H, TILE_W, gridToIso, sceneOrigin } from "../../src/renderer/gridProjection";
import type { SceneModel } from "../../src/renderer/scene";
import { buildSceneModel } from "../../src/renderer/scene";

const MAPS = parseMapsYaml(readFileSync(join(process.cwd(), "data", "maps.yaml"), "utf8"));
const VIEWPORT = { width: 1024, height: 768 };
const EMPTY = { move: new Set<string>(), cast: new Set<string>(), hover: null };

interface Scenario {
  map: AsciiMap;
  origin: IsoOrigin;
  scene: SceneModel;
}

function mapDef(id: string): MapDef {
  const def = MAPS.find((entry) => entry.id === id);
  if (def === undefined) throw new Error(`carte absente: ${id}`);
  return def;
}

function sceneOf(id: string): Scenario {
  const map: AsciiMap = parseAsciiMap(mapDef(id).grid);
  const origin = sceneOrigin({ width: map.width, height: map.height }, VIEWPORT);
  return { map, origin, scene: buildSceneModel({ map, highlight: EMPTY, origin }) };
}

function cellsOf(id: string): Position[] {
  return sceneOf(id).scene.exitMarks.map((mark) => mark.cell);
}

function labels(cells: readonly Position[]): string[] {
  return cells.map((cell) => `${cell.x},${cell.y}`).sort();
}

describe("soleils — un marqueur par sortie de données", () => {
  it("pose un seul soleil sur la plage, au centre de la case (11,4)", () => {
    const { origin, scene } = sceneOf("ferraille_plage_01");
    expect(scene.exitMarks).toHaveLength(1);
    const [mark] = scene.exitMarks;
    expect(mark?.cell).toEqual({ x: 11, y: 4 });
    expect(mark?.center).toEqual(gridToIso({ x: 11, y: 4, origin }));
  });

  it("pose deux soleils sur le quai", () => {
    expect(labels(cellsOf("ferraille_quai_02"))).toEqual(["0,4", "9,4"]);
  });

  it("pose un soleil sur la cale", () => {
    expect(labels(cellsOf("ferraille_cale_03"))).toEqual(["0,4"]);
  });

  it("n'en pose aucun dans les quatre salles de donjon", () => {
    const rooms = MAPS.filter((entry) => entry.exits.length === 0);
    expect(rooms).toHaveLength(4);
    rooms.forEach((room) => expect(sceneOf(room.id).scene.exitMarks).toEqual([]));
  });

  it("compte exactement les sorties déclarées pour chaque carte", () => {
    MAPS.forEach((entry) => expect(sceneOf(entry.id).scene.exitMarks).toHaveLength(entry.exits.length));
  });
});

describe("soleils — géométrie dérivée de la grille", () => {
  it("trace un losange 2:1 plus petit que la case", () => {
    const { origin } = sceneOf("ferraille_plage_01");
    const diamond = exitMarkDiamond({ x: 11, y: 4, origin });
    const width = (diamond.points[2] ?? 0) - (diamond.points[6] ?? 0);
    const height = (diamond.points[5] ?? 0) - (diamond.points[1] ?? 0);
    expect(diamond.points).toHaveLength(8);
    expect(width).toBeCloseTo(TILE_W * EXIT_MARK_RATIO * (origin.scale ?? 1), 6);
    expect(height).toBeCloseTo(TILE_H * EXIT_MARK_RATIO * (origin.scale ?? 1), 6);
    expect(width).toBeCloseTo(2 * height, 6);
    expect(width).toBeLessThan(TILE_W);
  });

  it("garde un ratio de 35 % à 45 % aux deux zooms du jeu", () => {
    expect(EXIT_MARK_RATIO).toBeGreaterThanOrEqual(0.35);
    expect(EXIT_MARK_RATIO).toBeLessThanOrEqual(0.45);
    [1.45, 2.19].forEach((scale) => {
      const diamond = exitMarkDiamond({ x: 1, y: 1, origin: { x: 0, y: 0, scale } });
      const width = (diamond.points[2] ?? 0) - (diamond.points[6] ?? 0);
      expect(width / (TILE_W * scale)).toBeCloseTo(EXIT_MARK_RATIO, 6);
    });
  });

  it("suit l'échelle de la caméra, jamais une constante", () => {
    const one = exitMarkDiamond({ x: 2, y: 3, origin: { x: 10, y: 20, scale: 1 } });
    const two = exitMarkDiamond({ x: 2, y: 3, origin: { x: 10, y: 20, scale: 2 } });
    const widthOne = (one.points[2] ?? 0) - (one.points[6] ?? 0);
    const widthTwo = (two.points[2] ?? 0) - (two.points[6] ?? 0);
    expect(widthTwo).toBeCloseTo(2 * widthOne, 6);
    expect(one.cx).toBeCloseTo(gridToIso({ x: 2, y: 3, origin: { x: 10, y: 20, scale: 1 } }).x, 6);
    expect(two.cy).toBeCloseTo(gridToIso({ x: 2, y: 3, origin: { x: 10, y: 20, scale: 2 } }).y, 6);
  });

});

describe("soleils — placement et palette", () => {
  it("reste à l'intérieur de la case qui le porte", () => {
    const { origin, scene } = sceneOf("ferraille_quai_02");
    const halfW = (TILE_W / 2) * (origin.scale ?? 1);
    const halfH = (TILE_H / 2) * (origin.scale ?? 1);
    scene.exitMarks.forEach((mark) => {
      for (let index = 0; index < mark.points.length; index += 2) {
        const dx = Math.abs((mark.points[index] ?? 0) - mark.center.x) / halfW;
        const dy = Math.abs((mark.points[index + 1] ?? 0) - mark.center.y) / halfH;
        expect(dx + dy).toBeLessThanOrEqual(1);
      }
    });
  });

  it("ne fait chevaucher aucun des deux soleils du quai", () => {
    const { scene } = sceneOf("ferraille_quai_02");
    const [first, second] = scene.exitMarks;
    expect(first && second).toBeDefined();
    if (first === undefined || second === undefined) return;
    const width = (first.points[2] ?? 0) - (first.points[6] ?? 0);
    expect(Math.abs(first.center.x - second.center.x)).toBeGreaterThan(width);
  });

  it("reste déterministe d'une construction à l'autre", () => {
    expect(sceneOf("ferraille_plage_01").scene.exitMarks).toEqual(sceneOf("ferraille_plage_01").scene.exitMarks);
  });

  it("n'invente aucune couleur : le doré de la palette", () => {
    expect(EXIT_MARK_FILL).toBe(0xf2d64b);
  });
});
