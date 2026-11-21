import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TILE_SIZE,
  canvasSize,
  gridToPixel,
  gridToScreenOrigin,
  pixelToGrid,
} from "../../src/renderer/gridProjection";
import {
  BASE_ALPHA,
  CAST_HIGHLIGHT,
  HOVER_STROKE,
  MOVE_HIGHLIGHT,
  TILE_COLORS,
  getTileColor,
  resolveTileStyle,
} from "../../src/renderer/tileStyle";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { hpRatio } from "../../src/renderer/tokens";

function demoSize(): { width: number; height: number } {
  const raw = readFileSync(join(process.cwd(), "data", "maps.yaml"), "utf8");
  const map = parseMapsYaml(raw)[0];
  return { width: map?.width ?? 12, height: map?.height ?? 12 };
}

const CORNERS = [
  { x: 0, y: 0 },
  { x: 11, y: 0 },
  { x: 0, y: 11 },
  { x: 11, y: 11 },
  { x: 6, y: 6 },
];

const BASE_INPUT = { cell: ".", isMoveCell: false, isCastCell: false, isHovered: false } as const;

describe("gridProjection — géométrie", () => {
  it("expose une taille de tuile de 48 px", () => {
    expect(TILE_SIZE).toBe(48);
  });

  it("place le centre d'une tuile", () => {
    expect(gridToPixel({ x: 0, y: 0 })).toEqual({ x: 24, y: 24 });
    expect(gridToPixel({ x: 3, y: 2 })).toEqual({ x: 168, y: 120 });
  });

  it("place l'origine haut-gauche d'une tuile", () => {
    expect(gridToScreenOrigin({ x: 1, y: 2 })).toEqual({ x: 48, y: 96 });
  });

  it("calcule la taille du canvas de la plage en 12x12", () => {
    expect(demoSize()).toEqual({ width: 12, height: 12 });
    expect(canvasSize(demoSize())).toEqual({ width: 576, height: 576 });
  });

  it("fait l'aller-retour pixel/grille sur les coins et le centre", () => {
    const size = demoSize();
    CORNERS.forEach((cell) => {
      expect(pixelToGrid(gridToPixel(cell), size)).toEqual(cell);
    });
  });
});

describe("gridProjection — bornes", () => {
  it("renvoie null hors de la grille", () => {
    const size = demoSize();
    expect(pixelToGrid({ x: -1, y: 10 }, size)).toBeNull();
    expect(pixelToGrid({ x: 10, y: -1 }, size)).toBeNull();
    expect(pixelToGrid({ x: 576, y: 10 }, size)).toBeNull();
    expect(pixelToGrid({ x: 10, y: 576 }, size)).toBeNull();
  });

  it("accepte la dernière fraction de la dernière tuile", () => {
    expect(pixelToGrid({ x: 575.9, y: 575.9 }, demoSize())).toEqual({ x: 11, y: 11 });
  });

  it("rejette les coordonnées non finies", () => {
    const size = demoSize();
    expect(pixelToGrid({ x: Number.NaN, y: 0 }, size)).toBeNull();
    expect(pixelToGrid({ x: 0, y: Number.POSITIVE_INFINITY }, size)).toBeNull();
    expect(pixelToGrid({ x: Number.NEGATIVE_INFINITY, y: 0 }, size)).toBeNull();
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
