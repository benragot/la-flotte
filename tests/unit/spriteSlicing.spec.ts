import { describe, expect, it } from "vitest";
import { animationRects } from "../../src/renderer/sprites/frameMath";
import { sheetPlan } from "../../src/renderer/sprites/sheetPlan";
import type { AnimationSpec, SpriteSheetSpec } from "../../src/renderer/sprites/types";

const ANIMATION = (row: number, frames: number): AnimationSpec => ({ row, frames, fps: 6, loop: true });

function fixture(overrides: Partial<SpriteSheetSpec> = {}, animations?: Partial<Record<string, AnimationSpec>>): SpriteSheetSpec {
  return {
    entityId: "iop",
    path: "/assets/sprites/iop.svg",
    frameWidth: 64,
    frameHeight: 64,
    animations: {
      idle: ANIMATION(0, 4),
      walk: ANIMATION(1, 4),
      attack: ANIMATION(2, 4),
      hit: ANIMATION(3, 4),
      ...animations,
    },
    ...overrides,
  };
}

describe("animationRects — découpe pilotée par le manifeste", () => {
  it("utilise la taille de cellule demandée", () => {
    const rects = animationRects({ row: 1, frames: 2, frameWidth: 32, frameHeight: 48 });
    expect(rects).toEqual([
      { x: 0, y: 48, width: 32, height: 48 },
      { x: 32, y: 48, width: 32, height: 48 },
    ]);
  });

  it("respecte le nombre de frames", () => {
    expect(animationRects({ row: 0, frames: 8, frameWidth: 64, frameHeight: 64 })).toHaveLength(8);
  });
});

describe("sheetPlan — lignes lues dans le manifeste", () => {
  it("découpe chaque animation sur la ligne déclarée", () => {
    const plan = sheetPlan(fixture());
    expect(plan.idle.map((rect) => rect.y)).toEqual([0, 0, 0, 0]);
    expect(plan.walk.map((rect) => rect.y)).toEqual([64, 64, 64, 64]);
    expect(plan.attack[2]).toEqual({ x: 128, y: 128, width: 64, height: 64 });
    expect(plan.hit[0]).toEqual({ x: 0, y: 192, width: 64, height: 64 });
  });

  it("suit une permutation de lignes dans le manifeste", () => {
    const base = sheetPlan(fixture());
    const swapped = sheetPlan(fixture({}, { idle: ANIMATION(1, 4), walk: ANIMATION(0, 4) }));
    expect(swapped.idle[0]?.y).toBe(64);
    expect(swapped.walk[0]?.y).toBe(0);
    expect(swapped.idle[0]).not.toEqual(base.idle[0]);
    expect(swapped.walk[0]).toEqual(base.idle[0]);
  });

  it("suit le nombre de frames et la taille de cellule du manifeste", () => {
    const plan = sheetPlan(
      fixture(
        { frameWidth: 32, frameHeight: 48 },
        { idle: ANIMATION(0, 8) },
      ),
    );
    expect(plan.idle).toHaveLength(8);
    expect(plan.idle[1]).toEqual({ x: 32, y: 0, width: 32, height: 48 });
  });
});
