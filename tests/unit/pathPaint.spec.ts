import { describe, expect, it, vi } from "vitest";
import type { Application } from "pixi.js";
import type { ViewModel } from "../../src/renderer/combatSceneModel";
import type { PathHint } from "../../src/renderer/scene";
import type { TileView } from "../../src/renderer/scene";
import { PATH_ALPHA, PATH_HIGHLIGHT, PATH_STYLE } from "../../src/renderer/tileStyle";
import type { TokenView } from "../../src/renderer/tokens";
import type { FakeNode as FakeNodeType } from "./support/fakePixi";

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

const { FakeNode, FakeText, graphicsOf } = await import("./support/fakePixi");
const { renderScene } = await import("../../src/renderer/sceneLayers");

/** Couche du chemin dans l'ordre de création de `createLayers` : grille, décor, haut, surbrillance, chemin. */
const PATH_LAYER_OFFSET = 4;

function tile(position: { x: number; y: number }, center: { x: number; y: number }): TileView {
  const points = [center.x, center.y - 16, center.x + 32, center.y, center.x, center.y + 16, center.x - 32, center.y];
  return { cell: ".", position, center, points, scale: 2, style: PATH_STYLE, material: "sable", texture: [] };
}

function hint(payable: boolean): PathHint {
  return { cost: 5, payable, target: tile({ x: 3, y: 1 }, { x: 220, y: 140 }) };
}

function view(path: TileView[], pathHint: PathHint | null): ViewModel {
  const scene = { tiles: [], highlights: [], decor: [], outlines: [], exitMarks: [] };
  const tokens: TokenView[] = [];
  return { scene, tokens, hpBarTokens: tokens, path, pathHint, lastAction: null };
}

function fakeApp(): Application {
  const stage = new FakeNode();
  const ticker = { add: (): void => undefined, start: (): void => undefined };
  const app = { renderer: {}, stage, ticker, render: (): void => undefined, screen: { width: 1024, height: 768 } };
  return app as unknown as Application;
}

/** Peint une vue et renvoie l'apparence de la seule couche de chemin à cette image. */
function paintPathLayer(path: TileView[], pathHint: PathHint | null) {
  const offset = graphicsOf.length;
  renderScene(fakeApp(), view(path, pathHint), {});
  const layer = graphicsOf[offset + PATH_LAYER_OFFSET];
  if (layer === undefined) throw new Error("couche de chemin absente");
  return layer;
}

/** Tous les textes posés sous un nœud, à n'importe quelle profondeur. */
function texts(node: FakeNodeType): string[] {
  const own = node instanceof FakeText ? [node.text] : [];
  return [...own, ...node.children.flatMap(texts)];
}

function stageOf(app: Application): FakeNodeType {
  return app.stage as unknown as FakeNodeType;
}

describe("couche de chemin — une pastille ronde par case (§3.2, §5)", () => {
  it("peint un cercle par case et aucun losange plein", () => {
    const layer = paintPathLayer([tile({ x: 2, y: 1 }, { x: 180, y: 120 }), tile({ x: 3, y: 1 }, { x: 220, y: 140 })], null);
    expect(layer.circleCalls).toBe(2);
    expect(layer.polyCalls).toBe(0);
  });

  it("ne peint rien sans chemin", () => {
    const layer = paintPathLayer([], null);
    expect(layer.circleCalls).toBe(0);
    expect(layer.polyCalls).toBe(0);
  });
});

describe("couche de chemin — cible hors budget", () => {
  it("trace le losange et la croix du refus, pas de pastille", () => {
    const layer = paintPathLayer([], hint(false));
    expect(layer.polyCalls).toBe(1);
    expect(layer.circleCalls).toBe(0);
  });

  it("n'ajoute ni croix ni contour quand le chemin est payable", () => {
    expect(paintPathLayer([], hint(true)).polyCalls).toBe(0);
  });
});

describe("couche de chemin — pastille de coût PM", () => {
  it("écrit « 5 PM » au-dessus du losange visé", () => {
    const app = fakeApp();
    renderScene(app, view([], hint(true)), {});
    expect(texts(stageOf(app))).toContain("5 PM");
  });

  it("n'écrit aucun texte sans aperçu", () => {
    const app = fakeApp();
    renderScene(app, view([], null), {});
    expect(texts(stageOf(app))).toEqual([]);
  });

  it("garde les constantes de la spec pour la couleur du chemin", () => {
    expect(PATH_HIGHLIGHT).toBe(0xf0b429);
    expect(PATH_ALPHA).toBe(0.32);
  });
});
