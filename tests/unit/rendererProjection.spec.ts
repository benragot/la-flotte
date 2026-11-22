import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { GridSize, IsoOrigin } from "../../src/renderer/gridProjection";
import {
  TILE_H,
  TILE_W,
  arenaScale,
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
/**
 * Arènes réellement mesurées dans le navigateur : canvas 1024x480 pour une
 * fenêtre 1280x720, 1664x840 pour 1920x1080, plus le 1024x570 rapporté en jeu.
 * Le losange 2:1 y est contraint par la largeur (ratio > 2) ou par la hauteur.
 */
const ARENAS = [
  { width: 1024, height: 480 },
  { width: 1664, height: 840 },
  { width: 1024, height: 570 },
];
/** Arène de référence pour les assertions d'origine. */
const ARENA = ARENAS[0] as GridSize;
/** Carte volontairement non carrée : l'origine ne doit pas supposer `width === height`. */
const RECT = { width: 5, height: 9 };
const ORIGIN = { x: 116, y: 108 };

function yamlDemoSize(): { width: number; height: number } {
  const raw = readFileSync(join(process.cwd(), "data", "maps.yaml"), "utf8");
  const map = parseMapsYaml(raw)[0];
  return { width: map?.width ?? 0, height: map?.height ?? 0 };
}

function cellsOf(map: GridSize): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) cells.push({ x, y });
  }
  return cells;
}

function allCells(): { x: number; y: number }[] {
  return cellsOf(DEMO_SIZE);
}

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Boîte d'encre du losange complet, mesurée sur les quatre sommets de chaque case. */
function inkBounds(map: GridSize, origin: IsoOrigin): Bounds {
  const corners = cellsOf(map).flatMap((cell) => gridDiamond({ ...cell, origin }).points);
  const xs = corners.filter((_, index) => index % 2 === 0);
  const ys = corners.filter((_, index) => index % 2 === 1);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

function margins(box: Bounds, viewport: GridSize): Bounds {
  return { left: box.left, right: viewport.width - box.right, top: box.top, bottom: viewport.height - box.bottom };
}

/** Marge gauche ≈ marge droite, marge haute ≈ marge basse : le losange est centré. */
function expectCentered(box: Bounds, viewport: GridSize): void {
  const m = margins(box, viewport);
  expect(Math.abs(m.left - m.right)).toBeLessThanOrEqual(1);
  expect(Math.abs(m.top - m.bottom)).toBeLessThanOrEqual(1);
}

/** Part de viewport couverte par l'encre, sur l'axe le plus défavorable. */
function minCoverage(box: Bounds, viewport: GridSize): number {
  const width = (box.right - box.left) / viewport.width;
  const height = (box.bottom - box.top) / viewport.height;
  return Math.min(width, height);
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

  it("isoMapSize mesure bien l'encre, demi-tuiles de bord comprises", () => {
    const box = inkBounds(DEMO_SIZE, { x: 0, y: 0 });
    expect(box.right - box.left).toBe(isoMapSize(DEMO_SIZE).width);
    expect(box.bottom - box.top).toBe(isoMapSize(DEMO_SIZE).height);
  });

  it("reste aligné sur les dimensions de la carte YAML de démonstration", () => {
    expect(yamlDemoSize()).toEqual(DEMO_SIZE);
  });
});

describe("gridProjection — caméra d'arène centrée", () => {
  it("centre le losange d'encre dans l'arène (marges égales à 1 px près)", () => {
    ARENAS.forEach((viewport) => expectCentered(inkBounds(DEMO_SIZE, sceneOrigin(DEMO_SIZE, viewport)), viewport));
  });

  it("centre aussi une carte non carrée 5x9", () => {
    ARENAS.forEach((viewport) => expectCentered(inkBounds(RECT, sceneOrigin(RECT, viewport)), viewport));
  });

  it("déduit l'origine de scène depuis la carte et le viewport", () => {
    const origin = sceneOrigin(DEMO_SIZE, ARENA);
    expect(origin.scale).toBe(arenaScale(DEMO_SIZE, ARENA));
    expect(origin).toEqual(centeredOrigin({ map: DEMO_SIZE, viewport: ARENA, scale: arenaScale(DEMO_SIZE, ARENA) }));
  });

  it("accepte une origine négative quand le losange dépasse un petit viewport", () => {
    const origin = centeredOrigin({ map: DEMO_SIZE, viewport: { width: 320, height: 200 } });
    expect(origin).toEqual({ x: 160, y: -92, scale: 1 });
    expect(origin.y).toBeLessThan(0);
  });
});

describe("gridProjection — couverture de l'arène", () => {
  it("met la carte à l'échelle pour couvrir au moins 95 % de l'arène", () => {
    ARENAS.forEach((viewport) => {
      const box = inkBounds(DEMO_SIZE, sceneOrigin(DEMO_SIZE, viewport));
      expect(minCoverage(box, viewport)).toBeGreaterThanOrEqual(0.95);
    });
  });

  it("garde le centre de chaque case dans l'arène : la case du héros reste visible", () => {
    ARENAS.forEach((viewport) => {
      const origin = sceneOrigin(DEMO_SIZE, viewport);
      allCells().forEach((cell) => {
        const point = gridToIso({ ...cell, origin });
        expect(point.x).toBeGreaterThanOrEqual(-0.5);
        expect(point.x).toBeLessThanOrEqual(viewport.width + 0.5);
        expect(point.y).toBeGreaterThanOrEqual(-0.5);
        expect(point.y).toBeLessThanOrEqual(viewport.height + 0.5);
      });
    });
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

describe("gridProjection — inverse à l'échelle de la caméra", () => {
  it("fait l'aller-retour sur toutes les cases aux trois échelles de caméra", () => {
    ARENAS.forEach((viewport) => {
      const origin = sceneOrigin(DEMO_SIZE, viewport);
      allCells().forEach((cell) => {
        const center = gridToIso({ ...cell, origin });
        expect(isoToGrid({ px: center.x, py: center.y, origin, ...DEMO_SIZE })).toEqual(cell);
      });
    });
  });

  it("fait l'aller-retour sur une carte non carrée, échelle cover comprise", () => {
    ARENAS.forEach((viewport) => {
      const origin = sceneOrigin(RECT, viewport);
      cellsOf(RECT).forEach((cell) => {
        const center = gridToIso({ ...cell, origin });
        expect(isoToGrid({ px: center.x, py: center.y, origin, ...RECT })).toEqual(cell);
      });
    });
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
