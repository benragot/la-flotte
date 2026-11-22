import { describe, expect, it } from "vitest";
import type { Graphics } from "pixi.js";
import {
  ENTITY_HOVER_ALPHA,
  ENTITY_HOVER_COLOR,
  ENTITY_HOVER_STROKE_ALPHA,
  ENTITY_HOVER_STROKE_WIDTH,
  drawEntityHover,
  entityHover,
} from "../../src/renderer/entityHover";
import type { GridSize, IsoOrigin } from "../../src/renderer/gridProjection";
import { gridDiamond, gridToIso, originScale, sceneOrigin } from "../../src/renderer/gridProjection";
import { boardLayoutOf, cellFromPointer } from "../../src/renderer/pointer";
import { SCENE_LAYER_ORDER } from "../../src/renderer/sceneLayerOrder";
import type { TokenView } from "../../src/renderer/tokens";
import { groupTokenView, playerTokenView } from "../../src/renderer/tokens";
import { HOVER_STROKE } from "../../src/renderer/tileStyle";

const ORIGIN: IsoOrigin = { x: 100, y: 60, scale: 2 };
const HERO = { x: 2, y: 3 };
const MONSTER = { x: 7, y: 1 };
const EMPTY_CELL = { x: 5, y: 5 };

/** Le héros et un groupe : deux jetons dont la case **logique** est connue. */
function tokens(): TokenView[] {
  const monster = { pos: MONSTER, totalLevel: 3, name: "Piou Mazouté", spriteId: null };
  return [playerTokenView(HERO, ORIGIN), groupTokenView(monster, ORIGIN)];
}

function indexOf(layer: (typeof SCENE_LAYER_ORDER)[number]): number {
  return SCENE_LAYER_ORDER.indexOf(layer);
}

interface PaintSpy {
  graphics: Graphics;
  polys: () => number;
  fills: () => number;
  lastFill: () => unknown;
  lastStroke: () => unknown;
}

/** Enregistre les primitives d'un losange : `poly`, puis `fill`, puis `poly`/`stroke`. */
function paintSpy(): PaintSpy {
  let polys = 0;
  let fill: unknown = null;
  let stroke: unknown = null;
  let fills = 0;
  const poly = (): void => {
    polys += 1;
  };
  const fillWith = (style: unknown): void => {
    fills += 1;
    fill = style;
  };
  const strokeWith = (style: unknown): void => {
    stroke = style;
  };
  const graphics = { poly, fill: fillWith, stroke: strokeWith } as unknown as Graphics;
  return { graphics, polys: () => polys, fills: () => fills, lastFill: () => fill, lastStroke: () => stroke };
}

describe("surbrillance d'entité — une seule, sur la case logique survolée", () => {
  it("produit exactement une surbrillance, sur la case exacte du monstre", () => {
    const marks = entityHover(tokens(), MONSTER);
    expect(marks).toHaveLength(1);
    expect(marks[0]?.cell).toEqual(MONSTER);
    expect(marks[0]?.points).toEqual(gridDiamond({ ...MONSTER, origin: ORIGIN }).points);
  });

  it("suit le héros quand le pointeur est sur sa case, jamais les deux", () => {
    expect(entityHover(tokens(), HERO).map((mark) => mark.cell)).toEqual([HERO]);
  });

  it("ne produit aucune surbrillance sans case survolée", () => {
    expect(entityHover(tokens(), null)).toEqual([]);
  });

  it("ne produit aucune surbrillance sur une case vide", () => {
    expect(entityHover(tokens(), EMPTY_CELL)).toEqual([]);
  });
});

describe("surbrillance d'entité — discrète et dans la palette", () => {
  it("garde la teinte « case survolée » de la palette 1.29", () => {
    expect(ENTITY_HOVER_COLOR).toBe(HOVER_STROKE);
  });

  it("reste dans la fourchette d'opacité discrète 0,08 → 0,14", () => {
    expect(ENTITY_HOVER_ALPHA).toBeGreaterThanOrEqual(0.08);
    expect(ENTITY_HOVER_ALPHA).toBeLessThanOrEqual(0.14);
  });

  it("garde un liseré fin, plus lisible que l'aplat sans le remplacer", () => {
    expect(ENTITY_HOVER_STROKE_WIDTH).toBeLessThanOrEqual(2);
    expect(ENTITY_HOVER_STROKE_ALPHA).toBeGreaterThan(ENTITY_HOVER_ALPHA);
  });

  it("peint un aplat et un liseré par surbrillance, rien sans entité", () => {
    const withMark = paintSpy();
    drawEntityHover(withMark.graphics, entityHover(tokens(), MONSTER));
    expect(withMark.polys()).toBe(2);
    expect(withMark.lastFill()).toEqual({ color: ENTITY_HOVER_COLOR, alpha: ENTITY_HOVER_ALPHA });
    expect(withMark.lastStroke()).toEqual({
      width: ENTITY_HOVER_STROKE_WIDTH * originScale(ORIGIN),
      color: ENTITY_HOVER_COLOR,
      alpha: ENTITY_HOVER_STROKE_ALPHA,
    });
    const empty = paintSpy();
    drawEntityHover(empty.graphics, []);
    expect([empty.polys(), empty.fills()]).toEqual([0, 0]);
  });
});

describe("ordre des couches — la surbrillance passe sous les jetons", () => {
  it("est peinte au-dessus du décor et des surbrillances de case", () => {
    expect(indexOf("hover")).toBeGreaterThan(indexOf("grid"));
    expect(indexOf("hover")).toBeGreaterThan(indexOf("decor"));
    expect(indexOf("hover")).toBeGreaterThan(indexOf("highlights"));
  });

  it("reste sous les jetons, les acteurs, les PV et les noms", () => {
    expect(indexOf("hover")).toBeLessThan(indexOf("tokens"));
    expect(indexOf("hover")).toBeLessThan(indexOf("actors"));
    expect(indexOf("hover")).toBeLessThan(indexOf("hpBars"));
    expect(indexOf("hover")).toBeLessThan(indexOf("labels"));
  });

  it("déclare chaque couche une seule fois", () => {
    expect(new Set(SCENE_LAYER_ORDER).size).toBe(SCENE_LAYER_ORDER.length);
  });
});

describe("survol exploration — la case pointée est la case peinte", () => {
  const MAP: GridSize = { width: 12, height: 12 };
  const VIEWPORTS: readonly GridSize[] = [
    { width: 1024, height: 570 },
    { width: 1664, height: 840 },
  ];

  it("retombe sur la case du jeton sous le pointeur, aux échelles 1,45 et 2,19", () => {
    VIEWPORTS.forEach((viewport) => {
      const layout = boardLayoutOf(MAP, viewport);
      const point = gridToIso({ ...MONSTER, origin: sceneOrigin(MAP, viewport) });
      expect(cellFromPointer(point, layout)).toEqual(MONSTER);
    });
  });

  it("refuse le pointeur hors du losange de la carte", () => {
    const layout = boardLayoutOf(MAP, VIEWPORTS[0] ?? MAP);
    expect(cellFromPointer({ x: -400, y: -400 }, layout)).toBeNull();
  });
});
