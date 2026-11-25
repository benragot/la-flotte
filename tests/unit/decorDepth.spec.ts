import { describe, expect, it, vi } from "vitest";
import type { Application } from "pixi.js";
import type { ViewModel } from "../../src/renderer/combatSceneModel";
import { isGroundDecal, type DecorView } from "../../src/renderer/decor";
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

function decorOf(type: DecorView["type"], x: number, y: number): DecorView {
  return { type, layer: "below", center: { x: x * 8, y: y * 4 }, scale: 1, depth: x + y };
}

function decorAt(x: number, y: number): DecorView {
  return decorOf("rocher", x, y);
}

function viewOf(decor: readonly DecorView[], tokens: ViewModel["tokens"]): ViewModel {
  const scene = { tiles: [], highlights: [], decor: [...decor], outlines: [], exitMarks: [] };
  return { scene, tokens, hpBarTokens: [], path: [] };
}

/** Enfants de la couche `actors` : c'est là que le décor occlusif et les acteurs partagent l'axe. */
function depthChildren(app: Application): Fake[] {
  const stage = app.stage as unknown as Fake;
  return (stage.children[ACTORS_RANK] as Fake | undefined)?.children ?? [];
}

function isGraphics(node: Fake): node is InstanceType<typeof FakeGraphics> {
  return node instanceof FakeGraphics;
}

/** Couche réelle du `stage` : son rang vient de `SCENE_LAYER_ORDER`, pas d'un offset codé. */
function layerAt(app: Application, name: (typeof SCENE_LAYER_ORDER)[number]): Fake {
  const stage = app.stage as unknown as Fake;
  const rank = SCENE_LAYER_ORDER.indexOf(name);
  const layer = stage.children[rank];
  if (layer === undefined) throw new Error(`couche ${name} absente au rang ${rank}`);
  return layer;
}

function renderApp(decor: readonly DecorView[], tokens: ViewModel["tokens"]): Application {
  const app = fakeApp();
  renderScene(app, viewOf(decor, tokens), { sheets: [SHEET] });
  return app;
}

function render(decor: readonly DecorView[], tokens: ViewModel["tokens"]): Fake[] {
  return depthChildren(renderApp(decor, tokens));
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
});

describe("props de décor — destruction réelle et split décals/objets", () => {
  it("détruit réellement les props du rendu précédent, pas seulement leurs liens", () => {
    const app = fakeApp();
    const view = viewOf([decorAt(5, 4)], [tokenAt(1, 2)]);
    renderScene(app, view, { sheets: [SHEET] });
    const previous = depthChildren(app).filter(isGraphics);
    renderScene(app, view, { sheets: [SHEET] });
    const current = depthChildren(app);
    expect(previous).toHaveLength(1);
    expect(current).toHaveLength(2);
    expect(current.filter(isGraphics)).toHaveLength(1);
    expect(previous.every((node) => node.destroyed)).toBe(true);
    expect(current.filter(isGraphics).every((node) => !node.destroyed)).toBe(true);
    expect(current).not.toContain(previous[0]);
  });

  it("garde les décals plats dans la couche basse et le rocher dans la séquence des acteurs", () => {
    const decor = [decorOf("algue", 2, 1), decorOf("ponton", 0, 8), decorOf("debris", 3, 7), decorOf("rocher", 5, 4)];
    const app = renderApp(decor, [tokenAt(1, 2)]);
    const ground = layerAt(app, "decor") as InstanceType<typeof FakeGraphics>;
    const depth = layerAt(app, "actors");
    const stage = app.stage as unknown as Fake;
    expect(isGroundDecal("algue")).toBe(true);
    expect(isGroundDecal("ponton")).toBe(true);
    expect(isGroundDecal("rocher")).toBe(false);
    expect(stage.children.indexOf(ground)).toBe(SCENE_LAYER_ORDER.indexOf("decor"));
    expect(stage.children.indexOf(depth)).toBe(SCENE_LAYER_ORDER.indexOf("actors"));
    expect(SCENE_LAYER_ORDER.indexOf("decor")).toBeLessThan(SCENE_LAYER_ORDER.indexOf("actors"));
    expect(ground.polyCalls).toBe(1);
    expect(depth.children.filter(isGraphics)).toHaveLength(1);
    expect(depth.children.filter(isGraphics)[0]?.polyCalls).toBe(2);
    expect(depth.children).toHaveLength(2);
  });
});
