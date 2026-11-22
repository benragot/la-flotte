import { describe, expect, it, vi } from "vitest";
import type { Application } from "pixi.js";
import type { ViewModel } from "../../src/renderer/combatSceneModel";
import type { SpriteSheetSpec } from "../../src/renderer/sprites/types";
import type { TokenView } from "../../src/renderer/tokens";

vi.mock("pixi.js", async () => {
  const { FakeAnimatedSprite, FakeGraphics, FakeNode, FakeText } = await import("./support/fakePixi");
  return {
    AnimatedSprite: FakeAnimatedSprite,
    Container: FakeNode,
    Graphics: FakeGraphics,
    Text: FakeText,
    Assets: { load: () => new Promise(() => undefined) },
    Texture: class {},
    Rectangle: class {},
  };
});

const { FakeNode, graphicsOf } = await import("./support/fakePixi");
const { renderScene } = await import("../../src/renderer/sceneLayers");

/** La couche `tokens` est la 6ᵉ `Graphics` créée par `createLayers` (grille, décor, décor haut, surbrillances, chemin, jetons). */
const TOKEN_LAYER_OFFSET = 5;

const ANIMATION = { row: 0, frames: 4, fps: 6, loop: true };

const SHEET: SpriteSheetSpec = {
  entityId: "iop",
  path: "/assets/sprites/iop.svg",
  frameWidth: 64,
  frameHeight: 64,
  animations: { idle: ANIMATION, walk: ANIMATION, attack: ANIMATION, hit: ANIMATION },
};

function token(spriteId: string | null): TokenView {
  const base = { center: { x: 100, y: 80 }, radius: 12, scale: 1, hp: 10, maxHp: 20, hpRatio: 0.5, badge: null, depth: 0 };
  return { ...base, fill: 0x3f7fd6, spriteId, facing: "right", animation: "idle", animationKey: "static" };
}

function view(tokens: TokenView[]): ViewModel {
  return { scene: { tiles: [], highlights: [], decor: [] }, tokens, path: [], lastAction: null };
}

function fakeApp(): Application {
  const stage = new FakeNode();
  const ticker = { add: (): void => undefined, start: (): void => undefined };
  const app = { renderer: {}, stage, ticker, render: (): void => undefined };
  return app as unknown as Application;
}

/** Peint une scène et renvoie le nombre de cercles posés par la couche des jetons. */
function paint(tokens: TokenView[], sheets: readonly SpriteSheetSpec[]): number {
  const offset = graphicsOf.length;
  renderScene(fakeApp(), view(tokens), sheets);
  return graphicsOf[offset + TOKEN_LAYER_OFFSET]?.circleCalls ?? 0;
}

describe("couche de scène — un jeton sans feuille ne disparaît jamais", () => {
  it("peint le cercle de repli quand la feuille est introuvable (combat)", () => {
    expect(paint([token("fer_rat_de_cale")], [SHEET])).toBe(2);
  });

  it("peint le cercle de repli quand le jeton n'a aucune feuille (exploration)", () => {
    expect(paint([token(null)], [SHEET])).toBe(2);
  });

  it("laisse la feuille connue au comédien animé, sans cercle dessous", () => {
    expect(paint([token("iop")], [SHEET])).toBe(0);
  });

  it("garde les deux jetons d'un combat mixte : feuille pour l'un, cercle pour l'autre", () => {
    expect(paint([token("iop"), token("fer_rat_de_cale")], [SHEET])).toBe(2);
  });
});
