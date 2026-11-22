import { Container, Graphics, Text } from "pixi.js";
import type { Application } from "pixi.js";
import { isApplicationAlive } from "./appLifecycle";
import type { ViewModel } from "./combatSceneModel";
import type { DecorView } from "./decor";
import { drawDecor } from "./decorPaint";
import { FloatingTextLayer } from "./floatingTextLayer";
import type { LabelBounds, TokenLabel } from "./labels";
import {
  LABEL_FILL,
  LABEL_FONT_SIZE,
  LABEL_STROKE,
  LABEL_STROKE_WIDTH,
  labelBounds,
  labelsFor,
  nameLabelFor,
  viewportBounds,
} from "./labels";
import { ActorStage } from "./sprites/actorStage";
import type { ActorSyncInput } from "./sprites/actorStage";
import type { SpriteSheetSpec } from "./sprites/types";
import { cellCenters } from "./walkTrail";
import { drawGrid, drawHighlights, drawOutlines, drawPath } from "./tilePaint";
import type { TokenView } from "./tokens";
import { BADGE_FILL, BADGE_RADIUS, BADGE_STROKE, drawActiveRings, drawHpBars, drawTokens, tokensNeedingCircle } from "./tokens";

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
  floats: FloatingTextLayer;
}

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
  const floats = new FloatingTextLayer();
  return { ...graphics, ...moreGraphics, actors: new ActorStage(sheets), labels: new Container(), floats };
}

function layersFor(app: Application, sheets: readonly SpriteSheetSpec[]): SceneLayers {
  const existing = LAYERS.get(app);
  if (existing !== undefined) return existing;
  const created = createLayers(sheets);
  const { grid, decor, decorAbove, highlights, path, tokens, actors, hpBars, labels, floats } = created;
  app.stage.addChild(grid, decor, highlights, path, tokens, actors.container, decorAbove, hpBars, labels, floats.container);
  LAYERS.set(app, created);
  return created;
}

function createBadgeText(badge: TokenLabel): Text {
  const style = { fontSize: LABEL_FONT_SIZE * badge.scale, fill: LABEL_FILL };
  const text = new Text({ text: badge.text, style });
  text.anchor.set(0.5);
  text.position.set(badge.x, badge.y);
  return text;
}

function paintBadgeCircle(graphics: Graphics, badge: TokenLabel): void {
  const radius = BADGE_RADIUS * badge.scale;
  graphics.circle(badge.x, badge.y, radius);
  graphics.fill({ color: BADGE_FILL, alpha: 0.9 });
  graphics.circle(badge.x, badge.y, radius);
  graphics.stroke({ width: 1.5, color: BADGE_STROKE, alpha: 1 });
}

function createBadgeNode(badge: TokenLabel): Container {
  const node = new Container();
  const circle = new Graphics();
  paintBadgeCircle(circle, badge);
  node.addChild(circle, createBadgeText(badge));
  return node;
}

/** Nom complet ancré en bas au-dessus de la barre : aucun recouvrement, jamais coupé. */
function createNameText(token: TokenView): Text | null {
  const name = nameLabelFor(token);
  if (name === null) return null;
  const style = { ...NAME_STYLE, fontSize: LABEL_FONT_SIZE * name.scale };
  return new Text({ text: name.text, style });
}

function addNameLabel(container: Container, text: Text | null, labels: readonly TokenLabel[]): void {
  const name = labels.find((label) => label.kind === "name");
  if (text === null || name === undefined) return;
  text.anchor.set(0.5, 1);
  text.position.set(name.x, name.y);
  container.addChild(text);
}

function addBadgeLabel(container: Container, labels: readonly TokenLabel[]): void {
  const badge = labels.find((label) => label.kind === "badge");
  if (badge === undefined) return;
  container.addChild(createBadgeNode(badge));
}

function addTokenLabels(container: Container, token: TokenView, bounds: LabelBounds): void {
  const text = createNameText(token);
  const labels = labelsFor({ token, bounds, nameWidth: text?.width ?? 0 });
  addNameLabel(container, text, labels);
  addBadgeLabel(container, labels);
}

function drawLabels(container: Container, view: ViewModel, viewport: { width: number; height: number }): void {
  const ink = labelBounds(view.scene.tiles) ?? { minX: 0, minY: 0, maxX: viewport.width, maxY: viewport.height };
  const bounds = viewportBounds(ink, viewport);
  view.tokens.forEach((token) => addTokenLabels(container, token, bounds));
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
 * frame 0 resterait figée. La boucle n'est démarrée que si la scène a quelque
 * chose à animer — un acteur à feuille ou un nombre de dégâts en vol.
 */
function ensureAnimationLoop(app: Application, layers: SceneLayers, view: ViewModel): void {
  if (ANIMATED.has(app) || !animates(view, layers)) return;
  ANIMATED.add(app);
  app.ticker.add(() => renderFrame(app, layers));
  app.ticker.start();
}

/** Acteur à feuille **ou** nombre en vol : les deux réclament une image par trame. */
function animates(view: ViewModel, layers: SceneLayers): boolean {
  const withSheet = view.tokens.length - tokensNeedingCircle(view.tokens, layers.actors.sheetIds).length;
  return withSheet > 0 || layers.floats.busy();
}

/** Une image : glissements des acteurs, âge des nombres flottants, puis rendu. */
function renderFrame(app: Application, layers: SceneLayers): void {
  if (!isApplicationAlive(app)) return;
  layers.actors.advance(app.ticker.lastTime);
  layers.floats.advance(app.ticker.lastTime);
  app.render();
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
function drawActorLayers(layers: SceneLayers, view: ViewModel, viewport: { width: number; height: number }): void {
  drawActiveRings(layers.tokens, view.tokens);
  drawTokens(layers.tokens, tokensNeedingCircle(view.tokens, layers.actors.sheetIds));
  drawDecor(layers.decorAbove, layerViews(view.scene.decor, "above"));
  drawHpBars(layers.hpBars, view.tokens);
  drawLabels(layers.labels, view, viewport);
}

/** Tout jeton qu'aucune feuille ne rend est peint en cercle : jamais omis, ni en combat ni en exploration. */
function drawLayers(layers: SceneLayers, view: ViewModel, viewport: { width: number; height: number }): void {
  drawBoardLayers(layers, view);
  drawActorLayers(layers, view, viewport);
}

/** Ce qu'un rendu doit connaître en plus de l'image : feuilles et identité de carte. */
export interface RenderInput {
  sheets?: readonly SpriteSheetSpec[];
  /** Carte dessinée : un changement invalide les trajets **et** les nombres en vol. */
  scene?: object | null;
}

/** Une seule identité de carte pour les deux animations : elles s'annulent ensemble. */
function sceneOf(view: ViewModel, input: RenderInput): object | null | undefined {
  return input.scene ?? view.sceneKey;
}

/** Demande de synchronisation des acteurs : centres de cases, carte et rappel de chargement. */
function actorSyncInput(paint: ScenePaint): ActorSyncInput {
  const { app, view, input } = paint;
  const centers = cellCenters(view.scene.tiles);
  const onReady = (): void => renderScene(app, view, input);
  return { tokens: view.tokens, onReady, centers, scene: sceneOf(view, input) };
}

/** Les nombres flottants arrivent du modèle tel quel : la couche ne recalcule rien. */
function syncFloats(layers: SceneLayers, view: ViewModel, scene: object | null | undefined): void {
  const { floats = [], tokens } = view;
  layers.floats.sync({ events: floats, tokens, scene });
}

/** Ce qu'une image peint : l'application, ses couches, le modèle et l'identité de carte. */
interface ScenePaint {
  app: Application;
  layers: SceneLayers;
  view: ViewModel;
  input: RenderInput;
}

/** Une image complète : plateau, acteurs puis nombres flottants, dans cet ordre. */
function paintScene(paint: ScenePaint): void {
  const { layers, view, input } = paint;
  clearLayers(layers);
  drawLayers(layers, view, paint.app.screen);
  syncFloats(layers, view, sceneOf(view, input));
  layers.actors.sync(actorSyncInput(paint));
}

/** Redessine la scène ; no-op immédiat si l'application a été détruite. */
export function renderScene(app: Application, view: ViewModel, input: RenderInput = {}): void {
  if (!isApplicationAlive(app)) return;
  const layers = layersFor(app, input.sheets ?? []);
  paintScene({ app, layers, view, input });
  ensureAnimationLoop(app, layers, view);
  app.render();
}
