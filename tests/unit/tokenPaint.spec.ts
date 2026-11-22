import { describe, expect, it } from "vitest";
import type { Graphics } from "pixi.js";
import type { TokenView } from "../../src/renderer/tokens";
import {
  BADGE_RADIUS,
  HP_BAR_WIDTH,
  STATIC_TOKEN_SPRITE,
  TOKEN_RADIUS,
  drawHpBars,
  drawTokens,
  hpBarFor,
  playerTokenView,
  tokenBadge,
} from "../../src/renderer/tokens";

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
    id: "t",
    center: { x: 32, y: 16 },
    radius: 12,
    scale: 1,
    fill: 0x3f7fd6,
    hp: 10,
    maxHp: 20,
    hpRatio: 0.5,
    badge: null,
    depth: 0,
    active: false,
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

describe("échelle de la caméra — les jetons suivent le décor", () => {
  const CELL = { x: 2, y: 3 };

  it("multiplie rayon, barre de PV et badge par l'échelle de l'origine", () => {
    const token = playerTokenView(CELL, { x: 100, y: 50, scale: 2 }, { ...STATIC_TOKEN_SPRITE, spriteId: "iop" });
    expect(token.radius).toBe(TOKEN_RADIUS * 2);
    expect(token.scale).toBe(2);
    expect(hpBarFor(token).width).toBe(HP_BAR_WIDTH * 2);
    expect(tokenBadge({ ...token, badge: "3" })?.radius).toBe(BADGE_RADIUS * 2);
  });

  it("garde la taille de référence quand l'origine n'a pas d'échelle", () => {
    const token = playerTokenView(CELL, { x: 0, y: 0 });
    expect(token.radius).toBe(TOKEN_RADIUS);
    expect(token.scale).toBe(1);
  });
});
