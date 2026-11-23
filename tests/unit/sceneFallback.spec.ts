import { describe, expect, it, vi } from "vitest";
import type { Application } from "pixi.js";
import type { Position } from "../../src/engine/grid";
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

/** `Graphics` créées par `createLayers`, dans l'ordre : grille, décor, décor haut, surbrillances, chemin, soleils, jetons. */
const EXIT_MARK_LAYER_OFFSET = 5;
const TOKEN_LAYER_OFFSET = 6;

const ANIMATION = { row: 0, frames: 4, fps: 6, loop: true };

const SHEET: SpriteSheetSpec = {
  entityId: "iop",
  path: "/assets/sprites/iop.svg",
  frameWidth: 64,
  frameHeight: 64,
  animations: { idle: ANIMATION, walk: ANIMATION, attack: ANIMATION, hit: ANIMATION },
};

function token(spriteId: string | null, cell: Position = { x: 0, y: 0 }, center = { x: 100, y: 80 }): TokenView {
  const base = { id: `t-${cell.x}-${cell.y}`, cell, center, radius: 12, scale: 1, hp: 10, maxHp: 20, hpRatio: 0.5, badge: null, name: null, depth: 0, active: false };
  return { ...base, fill: 0x3f7fd6, spriteId, facing: "right", animation: "idle", animationKey: "static" };
}

function view(tokens: TokenView[], hpBarTokens: TokenView[] = tokens): ViewModel {
  const scene = { tiles: [], highlights: [], decor: [], outlines: [], exitMarks: [] };
  return { scene, tokens, hpBarTokens, path: [], lastAction: null };
}

function exitView(): ViewModel {
  const mark = { cell: { x: 0, y: 0 }, center: { x: 100, y: 80 }, points: [100, 74, 106, 80, 100, 86, 94, 80], scale: 1 };
  return { scene: { tiles: [], highlights: [], decor: [], outlines: [], exitMarks: [mark] }, tokens: [], hpBarTokens: [], path: [], lastAction: null };
}

function fakeApp(): Application {
  const stage = new FakeNode();
  const ticker = { add: (): void => undefined, start: (): void => undefined };
  const app = { renderer: {}, stage, ticker, render: (): void => undefined, screen: { width: 1024, height: 768 } };
  return app as unknown as Application;
}

/** Peint une scène et renvoie le nombre de cercles posés par la couche des jetons. */
function paint(tokens: TokenView[], sheets: readonly SpriteSheetSpec[]): number {
  const offset = graphicsOf.length;
  renderScene(fakeApp(), view(tokens), { sheets });
  return graphicsOf[offset + TOKEN_LAYER_OFFSET]?.circleCalls ?? 0;
}

/** Un losange doré = deux tracés : l'aplat, puis son contour sombre. */
function paintExitMarks(): number {
  const offset = graphicsOf.length;
  renderScene(fakeApp(), exitView(), { sheets: [SHEET] });
  return graphicsOf[offset + EXIT_MARK_LAYER_OFFSET]?.polyCalls ?? 0;
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

describe("couche de scène — les soleils de sortie", () => {
  it("trace l'aplat et le contour sombre du losange doré", () => {
    expect(paintExitMarks()).toBe(2);
  });
});

/** Barres de PV peintes : deux `rect` par barre, le fond puis le remplissage. */
function paintedBars(tokens: TokenView[], bars: TokenView[], hoveredCell: Position | null = null): number {
  const offset = graphicsOf.length;
  renderScene(fakeApp(), view(tokens, bars), { sheets: [SHEET], hoveredCell });
  return graphicsOf.slice(offset).reduce((total, graphics) => total + graphics.rectCalls, 0);
}

describe("couche de scène — une seule barre de vie, celle du jeton survolé (§6 R4)", () => {
  it("peint la barre du jeton survolé, et une seule", () => {
    const hovered = token("iop");
    expect(paintedBars([hovered], [hovered], { x: 0, y: 0 })).toBe(2);
  });

  it("n'en peint aucune quand le survol est absent, même en combat", () => {
    expect(paintedBars([token("iop")], [token("iop")])).toBe(0);
  });

  it("n'en peint aucune quand la case survolée est vide", () => {
    expect(paintedBars([token("iop")], [token("iop")], { x: 4, y: 4 })).toBe(0);
  });

  it("ne peint pas N barres quand plusieurs jetons existent et un seul est survolé", () => {
    const hovered = token("iop");
    const other = token("fer_rat_de_cale", { x: 1, y: 0 }, { x: 132, y: 96 });
    expect(paintedBars([hovered, other], [hovered, other], { x: 0, y: 0 })).toBe(2);
  });

  it("garde le garde-fou d'exploration : aucune barre malgré un survol", () => {
    expect(paintedBars([token(null)], [], { x: 0, y: 0 })).toBe(0);
  });
});
