import { describe, expect, it, vi } from "vitest";
import type { Application } from "pixi.js";
import type { ViewModel } from "../../src/renderer/combatSceneModel";

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

const { FakeNode, nodesOf } = await import("./support/fakePixi");
const { renderScene } = await import("../../src/renderer/sceneLayers");
const { SCENE_LAYER_ORDER } = await import("../../src/renderer/sceneLayerOrder");

/** Le nœud factice tel que le mock le fournit : une valeur, pas un type exporté. */
type Fake = InstanceType<typeof FakeNode>;

/**
 * Ordre de **création** des couches dans `createLayers` : PixiJS ne nomme pas
 * les `Container`, c'est donc la seule façon de dire « ce nœud-là est
 * `hpBars` ». `sceneFallback.spec.ts` s'appuie déjà sur ce même ordre (rangs 5
 * et 6). Ce tableau ne dit **rien** de l'ordre de peinture : c'est justement
 * `SCENE_LAYER_ORDER` qui le décide, et le test ci-dessous vérifie ce que le
 * `stage` reçoit réellement.
 */
const CREATION_ORDER = [
  "grid",
  "decor",
  "decorAbove",
  "highlights",
  "path",
  "exitMarks",
  "tokens",
  "hpBars",
  "floats",
  "teamRings",
  "hover",
  "actors",
  "labels",
] as const;

const EMPTY_VIEW: ViewModel = {
  scene: { tiles: [], highlights: [], decor: [], outlines: [], exitMarks: [] },
  tokens: [],
  hpBarTokens: [],
  path: [],
};

function fakeApp(): Application {
  const stage = new FakeNode();
  const ticker = { add: (): void => undefined, start: (): void => undefined };
  const app = { renderer: {}, stage, ticker, render: (): void => undefined, screen: { width: 1024, height: 768 } };
  return app as unknown as Application;
}

/** Nom de la couche qu'un enfant du `stage` est réellement : son rang de création. */
function nameOfRank(rank: number): string {
  const name = CREATION_ORDER[rank];
  if (name === undefined) throw new Error(`couche inconnue au rang ${rank}`);
  return name;
}

function stageOf(app: Application): Fake {
  return app.stage as unknown as Fake;
}

/** Peint une fois et nomme, dans l'ordre reçu, les enfants que le `stage` porte. */
function stageOrder(app: Application): string[] {
  const firstRank = nodesOf.length;
  renderScene(app, EMPTY_VIEW);
  return stageOf(app).children.map((child) => nameOfRank(nodesOf.indexOf(child) - firstRank));
}

describe("ordre des couches — le stage reçoit l'ordre, pas seulement la constante", () => {
  it("empile les douze couches dans la séquence exacte de SCENE_LAYER_ORDER", () => {
    expect(stageOrder(fakeApp())).toEqual([...SCENE_LAYER_ORDER]);
  });

  it("n'empile les couches qu'une fois : un second rendu ne les duplique pas", () => {
    const app = fakeApp();
    const firstRank = nodesOf.length;
    renderScene(app, EMPTY_VIEW);
    renderScene(app, EMPTY_VIEW);
    const names = stageOf(app).children.map((child) => nameOfRank(nodesOf.indexOf(child) - firstRank));
    expect(names).toEqual([...SCENE_LAYER_ORDER]);
  });
});
