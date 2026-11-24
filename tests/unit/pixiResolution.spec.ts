import { describe, expect, it } from "vitest";
import type { Application } from "pixi.js";
import {
  MAX_PIXEL_RATIO,
  MIN_PIXEL_RATIO,
  pixiInitOptions,
  pixiResolution,
} from "../../src/renderer/pixiResolution";
import { resizeRenderer } from "../../src/renderer/rendererResize";

interface Probe {
  app: Application;
  resolution: () => number;
  sizes: Array<[number, number]>;
}

/** Application factice : `resize` retient la taille **CSS** et la résolution courante. */
function probeApp(resolution: number): Probe {
  const screen = { width: 1, height: 1 };
  const sizes: Array<[number, number]> = [];
  const renderer = {
    get resolution(): number {
      return resolution;
    },
    set resolution(value: number) {
      resolution = value;
    },
    resize(width: number, height: number): void {
      screen.width = width;
      screen.height = height;
      sizes.push([width, height]);
    },
  };
  const stage: { hitArea: unknown } = { hitArea: null };
  const app = { renderer, stage, screen, render: (): void => undefined };
  return { app: app as unknown as Application, resolution: () => resolution, sizes };
}

describe("pixiResolution", () => {
  it("rend la résolution exacte d'un DPR entier", () => {
    expect(pixiResolution(1)).toBe(MIN_PIXEL_RATIO);
    expect(pixiResolution(2)).toBe(2);
  });

  it("garde un DPR fractionnaire sous le plafond", () => {
    expect(pixiResolution(1.5)).toBe(1.5);
  });

  it("borne les DPR élevés au plafond", () => {
    expect(pixiResolution(3.5)).toBe(MAX_PIXEL_RATIO);
  });

  it.each([0, -2, Number.NaN, Number.POSITIVE_INFINITY])(
    "retombe sur 1× pour un DPR aberrant (%s)",
    (dpr) => {
      expect(pixiResolution(dpr)).toBe(1);
    },
  );
});

describe("pixiInitOptions", () => {
  it("active autoDensity pour garder le canvas dimensionné en pixels CSS", () => {
    expect(pixiInitOptions(2)).toEqual({ resolution: 2, autoDensity: true });
  });

  it("normalise un DPR absent au lieu de rendre en 0×", () => {
    expect(pixiInitOptions(0)).toEqual({ resolution: 1, autoDensity: true });
  });
});

describe("resizeRenderer — le HiDPI survit au redimensionnement", () => {
  it("conserve la résolution quand le DPR ne change pas", () => {
    const probe = probeApp(2);
    resizeRenderer(probe.app, { width: 1024, height: 570 }, 2);
    expect(probe.resolution()).toBe(2);
    expect(probe.sizes).toEqual([[1024, 570]]);
  });

  it("aligne la résolution sur un DPR différent au resize suivant", () => {
    const probe = probeApp(1);
    resizeRenderer(probe.app, { width: 800, height: 600 }, 3.5);
    expect(probe.resolution()).toBe(MAX_PIXEL_RATIO);
    expect(probe.sizes).toEqual([[800, 600]]);
  });

  it("change la résolution sans doubler les dimensions CSS transmises", () => {
    const probe = probeApp(1);
    resizeRenderer(probe.app, { width: 1024, height: 570 }, 2.5);
    const fake = probe.app as unknown as { stage: { hitArea: unknown }; screen: unknown };
    expect(probe.resolution()).toBe(2.5);
    expect(probe.sizes).toEqual([[1024, 570]]);
    expect(fake.screen).toEqual({ width: 1024, height: 570 });
    expect(fake.stage.hitArea).toBe(fake.screen);
  });

  it("ne touche pas une application détruite", () => {
    const dead = { renderer: null, stage: null, screen: {} } as unknown as Application;
    expect(() => resizeRenderer(dead, { width: 10, height: 10 }, 2)).not.toThrow();
  });
});
