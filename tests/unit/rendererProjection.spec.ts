import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TILE_H,
  TILE_W,
  centeredOrigin,
  gridDiamond,
  gridToIso,
  isoMapSize,
  isoToGrid,
  sceneOrigin,
} from "../../src/renderer/gridProjection";
import {
  BASE_ALPHA,
  CAST_HIGHLIGHT,
  HOVER_STROKE,
  MOVE_HIGHLIGHT,
  PATH_HIGHLIGHT,
  TILE_COLORS,
  getTileColor,
  resolveTileStyle,
} from "../../src/renderer/tileStyle";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { hpRatio } from "../../src/renderer/tokens";
import { combatCanvasSize, FALLBACK_GRID } from "../../src/renderer/combatCanvasConfig";

const DEMO_SIZE = { width: 12, height: 12 };
const VIEWPORT = { width: 1024, height: 768 };
const ORIGIN = { x: 116, y: 108 };

function yamlDemoSize(): { width: number; height: number } {
  const raw = readFileSync(join(process.cwd(), "data", "maps.yaml"), "utf8");
  const map = parseMapsYaml(raw)[0];
  return { width: map?.width ?? 0, height: map?.height ?? 0 };
}

function allCells(): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < DEMO_SIZE.height; y += 1) {
    for (let x = 0; x < DEMO_SIZE.width; x += 1) cells.push({ x, y });
  }
  return cells;
}

const BASE_INPUT = { cell: ".", isMoveCell: false, isCastCell: false, isHovered: false } as const;

describe("gridProjection — losanges 2:1", () => {
  it("expose des tuiles deux fois plus larges que hautes", () => {
    expect(TILE_W).toBe(64);
    expect(TILE_H).toBe(32);
    expect(TILE_W / TILE_H).toBe(2);
  });

  it("place le centre du losange d'une case", () => {
    expect(gridToIso({ x: 0, y: 0, origin: { x: 0, y: 0 } })).toEqual({ x: 0, y: 16 });
    expect(gridToIso({ x: 3, y: 2, origin: { x: 0, y: 0 } })).toEqual({ x: 32, y: 96 });
    expect(gridToIso({ x: 3, y: 2, origin: ORIGIN })).toEqual({ x: 148, y: 204 });
  });

  it("calcule la bounding box du losange complet", () => {
    expect(isoMapSize(DEMO_SIZE)).toEqual({ width: 768, height: 384 });
    expect(isoMapSize({ width: 1, height: 1 })).toEqual({ width: 64, height: 32 });
  });

  it("centre la bounding box dans un viewport large (origine positive)", () => {
    const origin = centeredOrigin({ ...isoMapSize(DEMO_SIZE), viewport: VIEWPORT });
    expect(origin).toEqual({ x: 128, y: 192 });
    expect(origin.x).toBeGreaterThan(0);
    expect(origin.y).toBeGreaterThan(0);
  });

  it("accepte une origine négative quand le viewport est plus petit que la carte", () => {
    const origin = centeredOrigin({ ...isoMapSize(DEMO_SIZE), viewport: { width: 320, height: 200 } });
    expect(origin).toEqual({ x: -224, y: -92 });
    expect(origin.x).toBeLessThan(0);
  });

  it("déduit l'origine de scène depuis la taille de la carte et le viewport", () => {
    expect(sceneOrigin(DEMO_SIZE, VIEWPORT)).toEqual(centeredOrigin({ ...isoMapSize(DEMO_SIZE), viewport: VIEWPORT }));
  });

  it("reste aligné sur les dimensions de la carte YAML de démonstration", () => {
    expect(yamlDemoSize()).toEqual(DEMO_SIZE);
  });
});

describe("gridProjection — inverse", () => {
  it("fait l'aller-retour sur toutes les cases d'une grille 12x12", () => {
    allCells().forEach((cell) => {
      const center = gridToIso({ ...cell, origin: ORIGIN });
      expect(isoToGrid({ px: center.x, py: center.y, origin: ORIGIN, ...DEMO_SIZE })).toEqual(cell);
    });
  });

  it("fait l'aller-retour sur une origine fractionnaire", () => {
    const origin = { x: 37.5, y: -12.25 };
    allCells().forEach((cell) => {
      const center = gridToIso({ ...cell, origin });
      expect(isoToGrid({ px: center.x, py: center.y, origin, ...DEMO_SIZE })).toEqual(cell);
    });
  });

  it("garde la case pour un point proche du centre", () => {
    const center = gridToIso({ x: 5, y: 7, origin: ORIGIN });
    const picked = isoToGrid({ px: center.x + 12, py: center.y + 5, origin: ORIGIN, ...DEMO_SIZE });
    expect(picked).toEqual({ x: 5, y: 7 });
  });
});

describe("gridProjection — bornes du losange", () => {
  it("renvoie null hors du losange", () => {
    const outside = [
      gridToIso({ x: -1, y: 0, origin: ORIGIN }),
      gridToIso({ x: 0, y: -1, origin: ORIGIN }),
      gridToIso({ x: 12, y: 0, origin: ORIGIN }),
      gridToIso({ x: 0, y: 12, origin: ORIGIN }),
      { x: -10_000, y: -10_000 },
    ];
    outside.forEach((point) => {
      expect(isoToGrid({ px: point.x, py: point.y, origin: ORIGIN, ...DEMO_SIZE })).toBeNull();
    });
  });

  it("rejette les coordonnées non finies", () => {
    expect(isoToGrid({ px: Number.NaN, py: 0, origin: ORIGIN, ...DEMO_SIZE })).toBeNull();
    expect(isoToGrid({ px: 0, py: Number.POSITIVE_INFINITY, origin: ORIGIN, ...DEMO_SIZE })).toBeNull();
    expect(isoToGrid({ px: Number.NEGATIVE_INFINITY, py: 0, origin: ORIGIN, ...DEMO_SIZE })).toBeNull();
  });
});

describe("gridDiamond — géométrie du losange", () => {
  it("retourne un centre et quatre sommets", () => {
    const diamond = gridDiamond({ x: 2, y: 3, origin: ORIGIN });
    expect({ x: diamond.cx, y: diamond.cy }).toEqual(gridToIso({ x: 2, y: 3, origin: ORIGIN }));
    expect(diamond.points).toHaveLength(8);
  });

  it("place les sommets haut, droite, bas et gauche de façon symétrique", () => {
    const { cx, cy, points } = gridDiamond({ x: 0, y: 0, origin: { x: 0, y: 0 } });
    expect(points).toEqual([cx, cy - TILE_H / 2, cx + TILE_W / 2, cy, cx, cy + TILE_H / 2, cx - TILE_W / 2, cy]);
    expect(points[1]).toBeLessThan(cy);
    expect(points[5]).toBeGreaterThan(cy);
    expect((points[1] ?? 0) + (points[5] ?? 0)).toBe(cy * 2);
  });
});

describe("combatCanvasSize — dimensions du conteneur", () => {
  it("garde le fallback 1x1 sans combat ni exploration", () => {
    expect(combatCanvasSize({ combat: null, viewport: VIEWPORT, hasExploration: false })).toEqual(FALLBACK_GRID);
  });

  it("suit la taille du conteneur quand une scène existe", () => {
    const empty = { combat: null, viewport: VIEWPORT, hasExploration: true };
    expect(combatCanvasSize(empty)).toEqual(VIEWPORT);
  });

  it("retombe sur le fallback si le conteneur n'est pas encore mesuré", () => {
    const unmeasured = { combat: null, viewport: { width: 0, height: 0 }, hasExploration: true };
    expect(combatCanvasSize(unmeasured)).toEqual(FALLBACK_GRID);
  });
});

describe("tileStyle — couleurs", () => {
  it("associe une couleur à chaque type de cellule", () => {
    ([".", "#", "~", "P", "M"] as const).forEach((cell) => {
      expect(getTileColor(cell)).toBe(TILE_COLORS[cell]);
    });
  });

  it("distingue les placements et le relief du sol", () => {
    expect(getTileColor("P")).not.toBe(getTileColor("."));
    expect(getTileColor("M")).not.toBe(getTileColor("."));
    expect(getTileColor("P")).not.toBe(getTileColor("M"));
    expect(getTileColor("~")).not.toBe(getTileColor("."));
    expect(getTileColor("#")).not.toBe(getTileColor("."));
  });

  it("teinte l'eau en bleu-vert et les murs en ardoise", () => {
    expect(getTileColor("~")).toBe(TILE_COLORS["~"]);
    expect(getTileColor("#")).toBe(TILE_COLORS["#"]);
    expect(PATH_HIGHLIGHT).not.toBe(MOVE_HIGHLIGHT);
  });
});

describe("tileStyle — priorités", () => {
  it("rend une tuile de base sans contour", () => {
    const style = resolveTileStyle(BASE_INPUT);
    expect(style.fill).toBe(TILE_COLORS["."]);
    expect(style.alpha).toBe(BASE_ALPHA);
    expect(style.stroke).toBeNull();
    expect(style.strokeAlpha).toBe(0);
  });

  it("surbrille une case atteignable en vert translucide", () => {
    const style = resolveTileStyle({ ...BASE_INPUT, isMoveCell: true });
    expect(style.fill).toBe(MOVE_HIGHLIGHT);
    expect(style.alpha).toBeLessThan(1);
  });

  it("priorise le ciblage du sort sur le déplacement", () => {
    const style = resolveTileStyle({ ...BASE_INPUT, isMoveCell: true, isCastCell: true });
    expect(style.fill).toBe(CAST_HIGHLIGHT);
  });

  it("ajoute le contour de survol jaune sur la couleur de base", () => {
    const style = resolveTileStyle({ ...BASE_INPUT, cell: "#", isHovered: true });
    expect(style.stroke).toBe(HOVER_STROKE);
    expect(style.strokeAlpha).toBe(1);
    expect(style.fill).toBe(TILE_COLORS["#"]);
  });

  it("garde la priorité du survol sur les surbrillances", () => {
    const style = resolveTileStyle({ ...BASE_INPUT, isMoveCell: true, isCastCell: true, isHovered: true });
    expect(style.stroke).toBe(HOVER_STROKE);
    expect(style.fill).toBe(CAST_HIGHLIGHT);
  });
});

describe("tileStyle — bornes", () => {
  it("borne les alphas entre 0 et 1", () => {
    const style = resolveTileStyle({ ...BASE_INPUT, cell: "~", isCastCell: true, isHovered: true });
    expect(style.alpha).toBeGreaterThanOrEqual(0);
    expect(style.alpha).toBeLessThanOrEqual(1);
    expect(style.strokeAlpha).toBeGreaterThanOrEqual(0);
    expect(style.strokeAlpha).toBeLessThanOrEqual(1);
  });

  it("borne le ratio de PV entre 0 et 1", () => {
    expect(hpRatio(10, 20)).toBe(0.5);
    expect(hpRatio(-5, 20)).toBe(0);
    expect(hpRatio(40, 20)).toBe(1);
    expect(hpRatio(10, 0)).toBe(0);
  });
});
