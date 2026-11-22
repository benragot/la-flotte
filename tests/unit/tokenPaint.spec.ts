import { describe, expect, it } from "vitest";
import type { Graphics } from "pixi.js";
import type { TokenView } from "../../src/renderer/tokens";
import { STATIC_TOKEN_SPRITE, drawHpBars, drawTokens } from "../../src/renderer/tokens";

interface PaintCounter {
  graphics: Graphics;
  rects: () => number;
}

/** Compte les `rect` : c'est la seule primitive utilisée par une barre de PV. */
function counter(): PaintCounter {
  let rects = 0;
  const graphics = {
    rect: () => {
      rects += 1;
    },
    circle: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
  } as unknown as Graphics;
  return { graphics, rects: () => rects };
}

function token(overrides: Partial<TokenView> = {}): TokenView {
  const base: TokenView = {
    center: { x: 32, y: 16 },
    radius: 12,
    fill: 0x3f7fd6,
    hp: 10,
    maxHp: 20,
    hpRatio: 0.5,
    badge: null,
    depth: 0,
    ...STATIC_TOKEN_SPRITE,
  };
  return { ...base, ...overrides };
}

describe("peinture des jetons — la barre de PV n'est peinte qu'une fois", () => {
  it("drawTokens ne peint aucune barre", () => {
    const paint = counter();
    drawTokens(paint.graphics, [token(), token({ spriteId: "iop" })]);
    expect(paint.rects()).toBe(0);
  });

  it("drawHpBars peint fond + remplissage par jeton", () => {
    const paint = counter();
    drawHpBars(paint.graphics, [token(), token(), token()]);
    expect(paint.rects()).toBe(6);
  });

  it("ne double jamais la peinture sur une scène mixte", () => {
    const paint = counter();
    const tokens = [token({ spriteId: "iop" }), token({ spriteId: null })];
    drawTokens(paint.graphics, tokens.filter((entry) => entry.spriteId === null));
    drawHpBars(paint.graphics, tokens);
    expect(paint.rects()).toBe(4);
  });
});
