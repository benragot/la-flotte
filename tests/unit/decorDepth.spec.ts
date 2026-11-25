import { describe, expect, it, vi } from "vitest";
import type { Application } from "pixi.js";
import type { ViewModel } from "../../src/renderer/combatSceneModel";
import type { DecorView } from "../../src/renderer/decor";
import type { SpriteSheetSpec } from "../../src/renderer/sprites/types";
import { STATIC_TOKEN_SPRITE, playerTokenView } from "../../src/renderer/tokens";

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

const { FakeGraphics, FakeNode } = await import("./support/fakePixi");
const { renderScene } = await import("../../src/renderer/sceneLayers");
const { SCENE_LAYER_ORDER } = await import("../../src/renderer/sceneLayerOrder");

type Fake = InstanceType<typeof FakeNode>;

const ORIGIN = { x: 0, y: 0, scale: 1 };
const ACTORS_RANK = SCENE_LAYER_ORDER.indexOf("actors");
const SHEET: SpriteSheetSpec = {
  entityId: "iop",
  path: "/assets/sprites/iop.svg",
  frameWidth: 64,
  frameHeight: 64,
  animations: {
    idle: { row: 0, frames: 4, fps: 6, loop: true },
    walk: { row: 1, frames: 4, fps: 6, loop: true },
    attack: { row: 2, frames: 4, fps: 6, loop: false },
    hit: { row: 3, frames: 4, fps: 6, loop: false },
  },
};

function fakeApp(): Application {
  const stage = new FakeNode();
  const ticker = { add: (): void => undefined, start: (): void => undefined };
  const app = { renderer: {}, stage, ticker, render: (): void => undefined, screen: { width: 1024, height: 768 } };
  return app as unknown as Application;
}

function tokenAt(x: number, y: number): ViewModel["tokens"][number] {
  const sprite = { ...STATIC_TOKEN_SPRITE, spriteId: "iop" };
  return playerTokenView({ x, y }, ORIGIN, sprite);
}

function decorAt(x: number, y: number): DecorView {
  const view = { type: "rocher", layer: "below", center: { x: x * 8, y: y * 4 }, scale: 1, depth: x + y };
  return view as DecorView;
}

function viewOf(decor: readonly DecorView[], tokens: ViewModel["tokens"]): ViewModel {
  const scene = { tiles: [], highlights: [], decor: [...decor], outlines: [], exitMarks: [] };
  return { scene, tokens, hpBarTokens: [], path: [], lastAction: null };
}

/** Enfants de la couche `actors` : c'est là que le décor occlusif et les acteurs partagent l'axe. */
function depthChildren(app: Application): Fake[] {
  const stage = app.stage as unknown as Fake;
  return (stage.children[ACTORS_RANK] as Fake | undefined)?.children ?? [];
}

function render(decor: readonly DecorView[], tokens: ViewModel["tokens"]): Fake[] {
  const app = fakeApp();
  renderScene(app, viewOf(decor, tokens), { sheets: [SHEET] });
  return depthChildren(app);
}

/** Rang exigé : un décor ou un acteur absent doit faire échouer le test, pas passer par `-1`. */
function rankOf(nodes: readonly Fake[], isDecor: boolean): number {
  const rank = nodes.findIndex((node) => node instanceof FakeGraphics === isDecor);
  expect(rank).toBeGreaterThanOrEqual(0);
  return rank;
}

describe("décor intercalé — l'acteur et l'objet partagent l'index de profondeur", () => {
  it("rend l'acteur avant un décor plus profond : le baril devant peut le masquer", () => {
    const nodes = render([decorAt(5, 4)], [tokenAt(1, 2)]);
    expect(rankOf(nodes, false)).toBeLessThan(rankOf(nodes, true));
  });

  it("rend un décor moins profond avant l'acteur : le baril derrière ne le cache plus", () => {
    const nodes = render([decorAt(1, 1)], [tokenAt(4, 4)]);
    expect(rankOf(nodes, true)).toBeLessThan(rankOf(nodes, false));
  });

  it("départage la même case : l'acteur est rendu après le décor, donc reste visible", () => {
    const nodes = render([decorAt(2, 3)], [tokenAt(2, 3)]);
    expect(rankOf(nodes, true)).toBeLessThan(rankOf(nodes, false));
  });

  it("ne laisse pas de décor fantôme quand la scène est repeinte", () => {
    const app = fakeApp();
    const view = viewOf([decorAt(5, 4)], [tokenAt(1, 2)]);
    renderScene(app, view, { sheets: [SHEET] });
    renderScene(app, view, { sheets: [SHEET] });
    expect(depthChildren(app)).toHaveLength(2);
  });
});
