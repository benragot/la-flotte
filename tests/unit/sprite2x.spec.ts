import { describe, expect, it, vi } from "vitest";
import { SPRITE_SHEETS } from "../../src/renderer/spriteManifest";
import { displayScaleFor } from "../../src/renderer/sprites/frameMath";
import { SPRITE_ANIMATIONS } from "../../src/renderer/sprites/types";
import type { SpriteAnimationName, SpriteSheetSpec } from "../../src/renderer/sprites/types";

/** Cellule de la feuille à 2× : 512 px de feuille, 4 colonnes de 128 px. */
const FRAME = 128;
const SHEET = FRAME * 4;

/**
 * Photographie des animations **avant** le passage à 2× (16 feuilles × 4
 * animations, identiques pour toutes les entités). Elle fige `row`, `frames`,
 * `fps` et `loop` : doubler la résolution ne doit pas toucher au découpage.
 */
const ANIMATION_SNAPSHOT = {
  idle: { row: 0, frames: 4, fps: 6, loop: true },
  walk: { row: 1, frames: 4, fps: 8, loop: true },
  attack: { row: 2, frames: 4, fps: 10, loop: false },
  hit: { row: 3, frames: 4, fps: 10, loop: false },
} as const;

describe("manifeste des feuilles — déclaration à 2×", () => {
  it("déclare une cellule de 128 × 128 pour les 16 entrées", () => {
    expect(SPRITE_SHEETS).toHaveLength(16);
    SPRITE_SHEETS.forEach((sheet) => {
      expect(sheet.frameWidth, sheet.entityId).toBe(FRAME);
      expect(sheet.frameHeight, sheet.entityId).toBe(FRAME);
    });
  });

  it("garde la grille 4 × 4 : la feuille fait 512 px", () => {
    SPRITE_SHEETS.forEach((sheet) => {
      expect(sheet.frameWidth * 4, sheet.entityId).toBe(SHEET);
      expect(sheet.frameHeight * 4, sheet.entityId).toBe(SHEET);
    });
  });

  it("garde les 64 animations (16 feuilles × 4) sans en perdre une seule", () => {
    const total = SPRITE_SHEETS.reduce((sum, sheet) => sum + Object.keys(sheet.animations).length, 0);
    expect(total).toBe(16 * SPRITE_ANIMATIONS.length);
    SPRITE_SHEETS.forEach((sheet) => {
      expect(Object.keys(sheet.animations).sort(), sheet.entityId).toEqual(["attack", "hit", "idle", "walk"]);
    });
  });

  it("laisse row, frames, fps et loop strictement inchangés", () => {
    SPRITE_SHEETS.forEach((sheet) => {
      SPRITE_ANIMATIONS.forEach((name) => {
        expect(sheet.animations[name], `${sheet.entityId}.${name}`).toEqual(ANIMATION_SNAPSHOT[name]);
      });
    });
  });
});

/* -------------------------------------------------- feuille chargée à 2× */

interface FakeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const fake = vi.hoisted(() => ({
  rects: [] as FakeRect[],
  source: { width: 512, height: 512, scaleMode: "linear" as string },
}));

vi.mock("pixi.js", async () => {
  const { FakeAnimatedSprite, FakeGraphics, FakeNode } = await import("./support/fakePixi");
  class Rectangle {
    constructor(
      readonly x: number,
      readonly y: number,
      readonly width: number,
      readonly height: number,
    ) {
      fake.rects.push({ x, y, width, height });
    }
  }
  class Texture {
    constructor(readonly options: { source: unknown; frame: unknown }) {}
  }
  const Assets = { load: async (): Promise<unknown> => ({ source: fake.source }) };
  return { Assets, Rectangle, Texture, AnimatedSprite: FakeAnimatedSprite, Container: FakeNode, Graphics: FakeGraphics };
});

const ANIMATION = (row: number, loop: boolean): SpriteSheetSpec["animations"][SpriteAnimationName] => ({
  row,
  frames: 4,
  fps: 6,
  loop,
});

const SPEC: SpriteSheetSpec = {
  entityId: "iop",
  path: "/assets/sprites/iop.svg",
  frameWidth: FRAME,
  frameHeight: FRAME,
  animations: { idle: ANIMATION(0, true), walk: ANIMATION(1, true), attack: ANIMATION(2, false), hit: ANIMATION(3, false) },
};

/** Charge la feuille avec des modules neufs : le cache de `spriteLoader` est module-global. */
async function loadFresh(): Promise<Record<string, readonly unknown[]>> {
  fake.rects.length = 0;
  vi.resetModules();
  const { loadSpriteSheet } = await import("../../src/renderer/sprites/spriteLoader");
  return (await loadSpriteSheet(SPEC)) as unknown as Record<string, readonly unknown[]>;
}

describe("chargement d'une feuille à 2×", () => {
  it("découpe quatre frames de 128 px par animation", async () => {
    const frames = await loadFresh();
    expect(frames.idle).toHaveLength(4);
    expect(fake.rects[0]).toEqual({ x: 0, y: 0, width: FRAME, height: FRAME });
    expect(fake.rects[4]).toEqual({ x: 0, y: FRAME, width: FRAME, height: FRAME });
    expect(fake.rects[15]).toEqual({ x: 3 * FRAME, y: 3 * FRAME, width: FRAME, height: FRAME });
  });

  it("échantillonne la texture en nearest pour des pixels nets", async () => {
    await loadFresh();
    expect(fake.source.scaleMode).toBe("nearest");
  });
});

/* ------------------------------------------------- taille à l'écran figée */

describe("displayScaleFor — la taille à l'écran ne bouge pas", () => {
  it("compense exactement le facteur 2 de la feuille", () => {
    expect(displayScaleFor(64)).toBe(1);
    expect(displayScaleFor(FRAME)).toBe(0.5);
  });

  it("garde une largeur affichée de 64 px monde à l'échelle 1", () => {
    expect(64 * displayScaleFor(64)).toBe(64);
    expect(FRAME * displayScaleFor(FRAME)).toBe(64);
  });

  it("garde la même largeur affichée au zoom réel du décor (2,19)", () => {
    const before = 64 * displayScaleFor(64, 2.19);
    const after = FRAME * displayScaleFor(FRAME, 2.19);
    expect(after).toBeCloseTo(before, 10);
    expect(after).toBeCloseTo(140.16, 10);
  });

  it("suit l'échelle du décor quand elle change", () => {
    expect(displayScaleFor(FRAME, 2)).toBe(1);
    expect(displayScaleFor(64, 2)).toBe(2);
  });

  it("ne divise jamais par zéro sur une largeur absurde", () => {
    expect(displayScaleFor(0, 3)).toBe(3);
  });
});

describe("EntitySprite à 2× — même encombrement dans la case", () => {
  it("divise par deux l'échelle Pixi d'une frame de 128 px", async () => {
    vi.resetModules();
    const { EntitySprite } = await import("../../src/renderer/sprites/EntitySprite");
    const frames = { idle: [{}], walk: [{}], attack: [{}], hit: [{}] } as never;
    const actor = new EntitySprite({ spec: SPEC, frames });
    actor.update({ point: { x: 0, y: 0 }, facing: "right", animation: "idle", signature: "s" });
    expect(actor.node.scale.x).toBe(0.5);
    expect(actor.node.scale.y).toBe(0.5);
    expect(FRAME * Math.abs(actor.node.scale.x)).toBe(64);
  });
});
