import { Container, Graphics, Text } from "pixi.js";
import type { Application } from "pixi.js";
import { isApplicationAlive } from "./appLifecycle";
import type { ViewModel } from "./combatSceneModel";
import type { DecorView } from "./decor";
import { drawDecor } from "./decorPaint";
import type { LabelBounds, NameLabel } from "./labels";
import {
  LABEL_FILL,
  LABEL_FONT_SIZE,
  LABEL_STROKE,
  LABEL_STROKE_WIDTH,
  clampLabelX,
  labelBounds,
  nameLabelFor,
} from "./labels";
import { ActorStage } from "./sprites/actorStage";
import type { SpriteSheetSpec } from "./sprites/types";
import { drawGrid, drawHighlights, drawOutlines, drawPath } from "./tilePaint";
import type { TokenBadge, TokenView } from "./tokens";
import { drawActiveRings, drawHpBars, drawTokens, tokenBadge, tokensNeedingCircle } from "./tokens";

interface SceneLayers {
  grid: Graphics;
  decor: Graphics;
  decorAbove: Graphics;
  highlights: Graphics;
  path: Graphics;
  tokens: Graphics;
  actors: ActorStage;
  hpBars: Graphics;
  labels: Container;
}

export const BADGE_FONT_SIZE = 11;
export const BADGE_TEXT_COLOR = 0xf2d64b;

/** Contour sombre : le nom reste lisible sur le sable clair comme sur l'eau. */
const NAME_STYLE = {
  fill: LABEL_FILL,
  fontWeight: "bold" as const,
  stroke: { color: LABEL_STROKE, width: LABEL_STROKE_WIDTH },
};

const LAYERS = new WeakMap<Application, SceneLayers>();

function createLayers(sheets: readonly SpriteSheetSpec[]): SceneLayers {
  const graphics = { grid: new Graphics(), decor: new Graphics(), decorAbove: new Graphics() };
  const moreGraphics = { highlights: new Graphics(), path: new Graphics(), tokens: new Graphics(), hpBars: new Graphics() };
  return { ...graphics, ...moreGraphics, actors: new ActorStage(sheets), labels: new Container() };
}

function layersFor(app: Application, sheets: readonly SpriteSheetSpec[]): SceneLayers {
  const existing = LAYERS.get(app);
  if (existing !== undefined) return existing;
  const created = createLayers(sheets);
  const { grid, decor, decorAbove, highlights, path, tokens, actors, hpBars, labels } = created;
  app.stage.addChild(grid, decor, highlights, path, tokens, actors.container, decorAbove, hpBars, labels);
  LAYERS.set(app, created);
  return created;
}

function createLabel(badge: TokenBadge): Text {
  const style = { fontSize: BADGE_FONT_SIZE * badge.scale, fill: BADGE_TEXT_COLOR };
  const label = new Text({ text: badge.text, style });
  label.anchor.set(0.5);
  label.position.set(badge.x, badge.y);
  return label;
}

function addLabel(container: Container, token: TokenView): void {
  const badge = tokenBadge(token);
  if (badge === null) return;
  container.addChild(createLabel(badge));
}

/** Nom complet ancré en bas au-dessus de la barre : aucun recouvrement, jamais coupé. */
function createNameLabel(label: NameLabel, bounds: LabelBounds | null): Text {
  const style = { ...NAME_STYLE, fontSize: LABEL_FONT_SIZE * label.scale };
  const text = new Text({ text: label.text, style });
  text.anchor.set(0.5, 1);
  text.position.set(clampNameX(label, text.width, bounds), label.y);
  return text;
}

function clampNameX(label: NameLabel, width: number, bounds: LabelBounds | null): number {
  return bounds === null ? label.x : clampLabelX(label.x, width / 2, bounds);
}

function addNameLabel(container: Container, token: TokenView, bounds: LabelBounds | null): void {
  const label = nameLabelFor(token);
  if (label === null) return;
  container.addChild(createNameLabel(label, bounds));
}

function drawLabels(container: Container, view: ViewModel): void {
  const bounds = labelBounds(view.scene.tiles);
  view.tokens.forEach((token) => {
    addLabel(container, token);
    addNameLabel(container, token, bounds);
  });
}

function clearLabels(container: Container): void {
  container.removeChildren().forEach((child) => child.destroy());
}

function clearLayers(layers: SceneLayers): void {
  layers.grid.clear();
  layers.decor.clear();
  layers.decorAbove.clear();
  layers.highlights.clear();
  layers.path.clear();
  layers.tokens.clear();
  layers.hpBars.clear();
  clearLabels(layers.labels);
}

/** Applications déjà branchées sur une boucle de rendu, pour ne pas empiler les tickers. */
const ANIMATED = new WeakSet<Application>();

/**
 * Une `AnimatedSprite` avance sur le ticker PixiJS : sans boucle de rendu, la
 * frame 0 resterait figée. La boucle n'est démarrée que si la scène contient
 * au moins un acteur à feuille, pour ne pas rendre en continu une scène statique.
 */
function ensureAnimationLoop(app: Application, view: ViewModel, sheets: ReadonlySet<string>): void {
  if (ANIMATED.has(app) || tokensNeedingCircle(view.tokens, sheets).length === view.tokens.length) return;
  ANIMATED.add(app);
  app.ticker.add(() => app.render());
  app.ticker.start();
}

function layerViews(decor: readonly DecorView[], layer: DecorView["layer"]): DecorView[] {
  return decor.filter((view) => view.layer === layer);
}

/**
 * Sol, décor opaque puis grille de cases : les contours restent visibles même
 * au-dessus de l'épave. Surbrillances et chemin ferment la couche plateau.
 */
function drawBoardLayers(layers: SceneLayers, view: ViewModel): void {
  drawGrid(layers.grid, view.scene.tiles);
  drawDecor(layers.decor, layerViews(view.scene.decor, "below"));
  drawOutlines(layers.grid, view.scene.outlines);
  drawHighlights(layers.highlights, view.scene.highlights);
  drawPath(layers.path, view.path);
}

/** Anneau doré **sous** les acteurs, puis jetons géométriques, PV et badges. */
function drawActorLayers(layers: SceneLayers, view: ViewModel): void {
  drawActiveRings(layers.tokens, view.tokens);
  drawTokens(layers.tokens, tokensNeedingCircle(view.tokens, layers.actors.sheetIds));
  drawDecor(layers.decorAbove, layerViews(view.scene.decor, "above"));
  drawHpBars(layers.hpBars, view.tokens);
  drawLabels(layers.labels, view);
}

/** Tout jeton qu'aucune feuille ne rend est peint en cercle : jamais omis, ni en combat ni en exploration. */
function drawLayers(layers: SceneLayers, view: ViewModel): void {
  drawBoardLayers(layers, view);
  drawActorLayers(layers, view);
}

/** Redessine la scène ; no-op immédiat si l'application a été détruite. */
export function renderScene(app: Application, view: ViewModel, sheets: readonly SpriteSheetSpec[] = []): void {
  if (!isApplicationAlive(app)) return;
  const layers = layersFor(app, sheets);
  clearLayers(layers);
  drawLayers(layers, view);
  layers.actors.sync({ tokens: view.tokens, onReady: () => renderScene(app, view, sheets) });
  ensureAnimationLoop(app, view, layers.actors.sheetIds);
  app.render();
}
