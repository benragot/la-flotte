import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Application } from "pixi.js";
import { getCastableCells } from "../../src/engine/combatLoop/castable";
import { getReachableCells } from "../../src/engine/combatLoop/cells";
import { initCombat } from "../../src/engine/combatLoop/init";
import type { CombatState } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import type { Position } from "../../src/engine/grid";
import { parseAsciiMap, samePosition } from "../../src/engine/grid";
import { buildViewModel } from "../../src/renderer/combatSceneModel";
import type { ViewModel } from "../../src/renderer/combatSceneModel";
import { gridToIso, sceneOrigin } from "../../src/renderer/gridProjection";
import {
  CAST_ELEMENT_COLORS,
  CAST_HIGHLIGHT,
  CAST_ZONE_BACKING,
  CAST_ZONE_BACKING_ALPHA,
  HOVER_STROKE,
  MOVE_HIGHLIGHT,
  PATH_HIGHLIGHT,
  resolveTileStyle,
} from "../../src/renderer/tileStyle";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { insetPoints } from "../../src/renderer/tilePaint";

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

const { FakeGraphics, FakeNode, graphicsOf } = await import("./support/fakePixi");
const { renderScene } = await import("../../src/renderer/sceneLayers");
const { SCENE_LAYER_ORDER } = await import("../../src/renderer/sceneLayerOrder");

type Fake = InstanceType<typeof FakeNode>;
type LayerName = (typeof SCENE_LAYER_ORDER)[number];

const read = (file: string): string => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const maps = parseMapsYaml(read("maps.yaml"));

const VIEWPORT = { width: 1024, height: 768 };
const MAP_SIZE = { width: 12, height: 12 };
const ORIGIN = sceneOrigin(MAP_SIZE, VIEWPORT);
const BASE = { cell: ".", isMoveCell: false, isCastCell: false, isHovered: false } as const;

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`introuvable: ${id}`);
  return found;
}

function demoMap() {
  return parseAsciiMap(mustFind(maps, "ferraille_plage_01").grid);
}

function combatState(): CombatState {
  return initCombat({
    map: demoMap(),
    hero: createHero("Balthazar", mustFind(classes, "iop")),
    monster: mustFind(monsters, "piou_mazoute"),
    spells,
  });
}

function castStyle(element: "earth" | "fire" | "water" | "air" | "neutral" | null) {
  return resolveTileStyle({ ...BASE, isCastCell: true, castElement: element });
}

describe("portée de sort — un aplat qui laisse lire la carte (§3.2, §6)", () => {
  it("garde l'aplat sous 0,20 : le sol, son motif et la grille restent sous la nappe", () => {
    expect(castStyle(null).alpha).toBeLessThanOrEqual(0.2);
    expect(castStyle(null).alpha).toBeGreaterThanOrEqual(0.12);
  });

  it("teinte la portée de la couleur de son élément (§3.1)", () => {
    expect(castStyle("fire").fill).toBe(CAST_ELEMENT_COLORS.fire);
    expect(castStyle("water").fill).toBe(CAST_ELEMENT_COLORS.water);
    expect(castStyle("air").fill).toBe(CAST_ELEMENT_COLORS.air);
  });

  it("garde CAST_HIGHLIGHT quand aucun élément n'est déclaré", () => {
    expect(castStyle(null).fill).toBe(CAST_HIGHLIGHT);
  });

  it("laisse le survol primer sur la portée : la case visée reste en or plein", () => {
    const style = resolveTileStyle({ ...BASE, isCastCell: true, isHovered: true });
    expect(style.stroke).toBe(HOVER_STROKE);
    expect(style.strokeAlpha).toBe(1);
    expect(style.strokeBacking).toBeUndefined();
  });
});

/** Les deux sols réellement jouables de la carte : sable et ponton. */
const PLAYABLE_GROUNDS = [0xd8bd82, 0x8b6a43];

/** Canal linéaire WCAG (sRGB) d'une couleur `0xRRGGBB`. */
function channel(color: number, shift: number): number {
  const raw = ((color >> shift) & 0xff) / 255;
  return raw <= 0.04045 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
}

function luminance(color: number): number {
  return 0.2126 * channel(color, 16) + 0.7152 * channel(color, 8) + 0.0722 * channel(color, 0);
}

/** Rapport de contraste WCAG entre deux couleurs opaques. */
function contrast(first: number, second: number): number {
  const top = Math.max(luminance(first), luminance(second)) + 0.05;
  const bottom = Math.min(luminance(first), luminance(second)) + 0.05;
  return top / bottom;
}

/** Couleur obtenue en posant `top` à `alpha` sur `bottom`. */
function composite(top: number, bottom: number, alpha: number): number {
  const mix = (shift: number): number => Math.round(((top >> shift) & 0xff) * alpha + ((bottom >> shift) & 0xff) * (1 - alpha));
  return (mix(16) << 16) + (mix(8) << 8) + mix(0);
}

describe("portée de sort — le liseré qui porte l'identification", () => {
  it("trace un liseré d'élément franc au lieu d'un aplat", () => {
    const style = castStyle("fire");
    expect(style.stroke).toBe(CAST_ELEMENT_COLORS.fire);
    expect(style.strokeAlpha).toBeGreaterThanOrEqual(0.9);
  });

  it("double le liseré d'un trait sombre : le seul ton à 3:1 sur sable ET sur ponton", () => {
    expect(castStyle("fire").strokeBacking).toBe(true);
    expect(castStyle("air").strokeBacking).toBe(true);
  });

  it("rentre le liseré pour ne jamais se confondre avec le contour plein de la zone PM", () => {
    const cast = castStyle("air");
    const move = resolveTileStyle({ ...BASE, isMoveCell: true });
    expect(cast.fill).toBe(move.fill);
    expect(cast.strokeInset).toBeGreaterThan(0);
    expect(cast.strokeInset).toBeLessThan(1);
    expect(move.strokeInset).toBeUndefined();
    expect(move.strokeBacking).toBeUndefined();
  });

  it("rentre réellement le losange du liseré dans la case", () => {
    const square = [0, 0, 10, 0, 10, 10, 0, 10];
    const inner = insetPoints(square, 0.55);
    expect(inner).toHaveLength(8);
    expect(inner[0]).toBeGreaterThan(0);
    expect(inner[1]).toBeGreaterThan(0);
    expect(inner[4]).toBeLessThan(10);
    expect(inner[5]).toBeLessThan(10);
  });
});

describe("portée de sort — le contraste du liseré, mesuré", () => {
  it("garde 3:1 entre le cœur de l'élément et son trait sombre, sur les deux sols", () => {
    PLAYABLE_GROUNDS.forEach((ground) => {
      const backing = composite(CAST_ZONE_BACKING, ground, CAST_ZONE_BACKING_ALPHA);
      Object.values(CAST_ELEMENT_COLORS).forEach((element) => expect(contrast(element, backing)).toBeGreaterThanOrEqual(3));
    });
  });

  it("garde 3:1 entre le trait sombre et le sol, sable comme ponton", () => {
    PLAYABLE_GROUNDS.forEach((ground) => {
      const backing = composite(CAST_ZONE_BACKING, ground, CAST_ZONE_BACKING_ALPHA);
      expect(contrast(backing, ground)).toBeGreaterThanOrEqual(3);
    });
  });
});

describe("couches — la portée ne passe jamais devant un acteur", () => {
  const rank = (layer: LayerName): number => SCENE_LAYER_ORDER.indexOf(layer);

  it("pose la portée au-dessus de la grille et du décor", () => {
    expect(rank("highlights")).toBeGreaterThan(rank("grid"));
    expect(rank("highlights")).toBeGreaterThan(rank("decor"));
  });

  it("la garde sous le survol, le chemin, les jetons, les acteurs et les barres", () => {
    const above: readonly LayerName[] = ["hover", "path", "tokens", "actors", "decorAbove", "hpBars", "labels", "floats"];
    above.forEach((layer) => expect(rank("highlights")).toBeLessThan(rank(layer)));
  });
});

/** Ennemi collé au héros : le sort de dégâts n'a qu'une cible, la zone PM reste large. */
function adjacentCombat(): CombatState {
  const base = combatState();
  const position = { x: base.player.position.x + 1, y: base.player.position.y };
  return { ...base, enemy: { ...base.enemy, position } };
}

function targetOf(combat: CombatState): Position {
  const free = getReachableCells(combat).filter((cell) => !samePosition(cell, combat.player.position));
  const [target] = free;
  if (target === undefined) throw new Error("aucune case atteignable au survol");
  return target;
}

function adjacentView(): ViewModel {
  const combat = adjacentCombat();
  const hoveredCell = targetOf(combat);
  return buildViewModel({ combat, selectedSpellId: "epee_du_destin", hoveredCell, viewport: VIEWPORT, modifierHeld: true });
}

describe("plusieurs portées à la fois — chacune se lit sans ambiguïté", () => {
  it("distingue la cible du sort, la zone PM, le chemin et la case survolée", () => {
    const view = adjacentView();
    const cast = view.scene.highlights.filter((tile) => tile.style.strokeBacking === true);
    const move = view.scene.highlights.filter((tile) => tile.style.stroke === MOVE_HIGHLIGHT);
    expect(cast.length).toBeGreaterThan(0);
    expect(move.length).toBeGreaterThan(0);
    cast.forEach((tile) => expect(tile.style.fill).toBe(CAST_ELEMENT_COLORS.fire));
    move.forEach((tile) => expect(tile.style.fill).toBe(MOVE_HIGHLIGHT));
    expect(view.path.length).toBeGreaterThan(0);
    expect(view.path.every((tile) => tile.style.fill === PATH_HIGHLIGHT && tile.style.stroke === null)).toBe(true);
  });

  it("garde la case survolée unique et cerclée d'or au milieu des deux zones", () => {
    const target = targetOf(adjacentCombat());
    const hovered = adjacentView().scene.tiles.filter((tile) => tile.style.stroke === HOVER_STROKE);
    expect(hovered).toHaveLength(1);
    expect(hovered[0]?.position).toEqual(target);
    expect(hovered[0]?.style.strokeAlpha).toBe(1);
  });

  it("couvre la vraie nappe (Bond, portée 1-4) sans redevenir opaque", () => {
    const combat = combatState();
    const cells = getCastableCells(combat, "bond");
    const view = buildViewModel({ combat, selectedSpellId: "bond", hoveredCell: null, viewport: VIEWPORT });
    expect(cells.length).toBeGreaterThan(4);
    cells.forEach((cell) => {
      const tile = view.scene.highlights.find((item) => samePosition(item.center, gridToIso({ ...cell, origin: ORIGIN })));
      expect(tile?.style.alpha).toBeLessThanOrEqual(0.2);
      expect(tile?.style.strokeBacking).toBe(true);
    });
  });
});

function fakeApp(): Application {
  const stage = new FakeNode();
  const ticker = { add: (): void => undefined, start: (): void => undefined };
  const app = { renderer: {}, stage, ticker, render: (): void => undefined, screen: { width: 1024, height: 768 } };
  return app as unknown as Application;
}

function combatView(): ViewModel {
  const combat = combatState();
  return buildViewModel({ combat, selectedSpellId: "bond", hoveredCell: null, viewport: VIEWPORT });
}

function at(app: Application, layer: LayerName): Fake {
  const stage = app.stage as unknown as Fake;
  const node = stage.children[SCENE_LAYER_ORDER.indexOf(layer)];
  if (node === undefined) throw new Error(`couche ${layer} absente`);
  return node;
}

/** Nœuds de décor occlusif : les seuls `Graphics` de la séquence des acteurs. */
function decorNodes(app: Application): Fake[] {
  return at(app, "actors").children.filter((node) => node instanceof FakeGraphics);
}

describe("survols répétés — aucun nœud de décor n'est recréé ni laissé", () => {
  it("ne crée aucun Graphic de plus sur dix survols et ne détruit aucun décor", () => {
    const app = fakeApp();
    renderScene(app, combatView(), { hoveredCell: null });
    const created = graphicsOf.length;
    const decor = decorNodes(app);
    expect(decor.length).toBeGreaterThan(0);
    for (let step = 0; step < 10; step += 1) renderScene(app, combatView(), { hoveredCell: { x: step, y: 1 } });
    expect(graphicsOf.length).toBe(created);
    expect(decorNodes(app).every((node, index) => node === decor[index])).toBe(true);
    expect(decor.every((node) => !node.destroyed)).toBe(true);
  });

  it("ne duplique ni ne perd de couche sur dix survols", () => {
    const app = fakeApp();
    for (let step = 0; step < 10; step += 1) renderScene(app, combatView(), { hoveredCell: { x: step, y: 1 } });
    expect((app.stage as unknown as Fake).children).toHaveLength(SCENE_LAYER_ORDER.length);
    expect(at(app, "decor").children).toHaveLength(0);
  });
});
