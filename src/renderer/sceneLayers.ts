import { Container, Graphics, Text } from "pixi.js";
import type { Application } from "pixi.js";
import type { Position } from "../engine/grid";
import { isApplicationAlive } from "./appLifecycle";
import type { ViewModel } from "./combatSceneModel";
import type { DecorView } from "./decor";
import { isGroundDecal } from "./decor";
import { decorNode, drawDecor } from "./decorPaint";
import { drawEntityHover, entityHover } from "./entityHover";
import { FloatingTextLayer } from "./floatingTextLayer";
import type { LabelBounds, TokenLabel } from "./labels";
import {
  LABEL_FILL,
  LABEL_FONT_SIZE,
  LABEL_STROKE,
  LABEL_STROKE_WIDTH,
  NAME_LABEL_ALPHA,
  NAME_LABEL_FILL,
  hoverBarInBounds,
  labelBounds,
  labelsFor,
  nameLabelFor,
  pathCostLabel,
  pathCostStyle,
  viewportBounds,
} from "./labels";
import { ActorStage } from "./sprites/actorStage";
import type { ActorSyncInput, DepthProp } from "./sprites/actorStage";
import type { SpriteSheetSpec } from "./sprites/types";
import { cellCenters } from "./walkTrail";
import { drawExitMarks } from "./exitPaint";
import { drawTeamRings } from "./teamRing";
import type { PathHint } from "./scene";
import { drawGrid, drawHighlights, drawInvalidTarget, drawOutlines, drawPath } from "./tilePaint";
import type { TokenView } from "./tokens";
import { BADGE_FILL, BADGE_RADIUS, BADGE_STROKE, drawActiveRings, drawTokens, hoveredHpBarTokens, paintHpBar, tokensNeedingCircle } from "./tokens";
import type { SceneLayerName } from "./sceneLayerOrder";
import { SCENE_LAYER_ORDER } from "./sceneLayerOrder";

interface SceneLayers {
  grid: Graphics;
  decor: Graphics;
  decorAbove: Graphics;
  highlights: Graphics;
  /** Surbrillance de l'entité survolée (aplat + liseré) : au-dessus du décor, sous les jetons. */
  hover: Graphics;
  path: Graphics;
  exitMarks: Graphics;
  /** Anneau d'équipe au sol : sous les jetons, sous le sprite et sous son ombre. */
  teamRings: Graphics;
  tokens: Graphics;
  actors: ActorStage;
  hpBars: Graphics;
  labels: Container;
  floats: FloatingTextLayer;
  /** Nœuds de décor occlusif réutilisés d'un rendu à l'autre, indexés par case. */
  propNodes: Map<string, Graphics>;
}

/** Contour sombre : le nom reste lisible sur le sable clair comme sur l'eau. */
const NAME_STYLE = {
  fill: NAME_LABEL_FILL,
  fontWeight: "bold" as const,
  stroke: { color: LABEL_STROKE, width: LABEL_STROKE_WIDTH },
};

const LAYERS = new WeakMap<Application, SceneLayers>();

/**
 * Ordre de **création** des `Graphics` : il reste celui des couches historiques
 * (les tests de repli y lisent des offsets). L'ordre **peintre**, lui, vient de
 * `SCENE_LAYER_ORDER` — la création ne décide de rien.
 */
function createLayers(sheets: readonly SpriteSheetSpec[]): SceneLayers {
  const graphics = { grid: new Graphics(), decor: new Graphics(), decorAbove: new Graphics() };
  const moreGraphics = { highlights: new Graphics(), path: new Graphics(), exitMarks: new Graphics() };
  const markers = { tokens: new Graphics(), hpBars: new Graphics() };
  const floats = new FloatingTextLayer();
  const rings = new Graphics();
  const propNodes = new Map<string, Graphics>();
  return { ...graphics, ...moreGraphics, ...markers, hover: new Graphics(), actors: new ActorStage(sheets), labels: new Container(), teamRings: rings, floats, propNodes };
}

/** Chaque couche rangée par son nom : `SCENE_LAYER_ORDER` reste la seule source d'ordre. */
function layerByName(layers: SceneLayers): Record<SceneLayerName, Container> {
  const board = { grid: layers.grid, decor: layers.decor, highlights: layers.highlights, hover: layers.hover, path: layers.path };
  const exits = { exitMarks: layers.exitMarks, teamRings: layers.teamRings, tokens: layers.tokens, actors: layers.actors.container, decorAbove: layers.decorAbove };
  const top = { hpBars: layers.hpBars, labels: layers.labels, floats: layers.floats.container };
  return { ...board, ...exits, ...top };
}

/**
 * Enfants du `stage` dans l'ordre peintre de `SCENE_LAYER_ORDER` : une seule
 * source d'ordre, donc la surbrillance de survol ne peut pas passer au-dessus
 * des jetons par accident.
 */
function stageLayers(layers: SceneLayers): Container[] {
  const byName = layerByName(layers);
  return SCENE_LAYER_ORDER.map((name) => byName[name]);
}

function layersFor(app: Application, sheets: readonly SpriteSheetSpec[]): SceneLayers {
  const existing = LAYERS.get(app);
  if (existing !== undefined) return existing;
  const created = createLayers(sheets);
  app.stage.addChild(...stageLayers(created));
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

/** Nom complet ancré en bas au-dessus de la tête : aucun recouvrement, jamais coupé. */
function createNameText(token: TokenView): Text | null {
  const name = nameLabelFor(token);
  if (name === null) return null;
  const style = { ...NAME_STYLE, fontSize: LABEL_FONT_SIZE * name.scale };
  const text = new Text({ text: name.text, style });
  text.alpha = NAME_LABEL_ALPHA;
  return text;
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
  const labels = labelsFor({ token, bounds, nameWidth: text?.width ?? 0, nameHeight: text?.height });
  addNameLabel(container, text, labels);
  addBadgeLabel(container, labels);
}

/** Bornes des étiquettes : le viewport, jamais l'encre — elle déborde le canvas de ~9 %. */
function sceneLabelBounds(view: ViewModel, viewport: { width: number; height: number }): LabelBounds {
  const ink = labelBounds(view.scene.tiles) ?? { minX: 0, minY: 0, maxX: viewport.width, maxY: viewport.height };
  return viewportBounds(ink, viewport);
}

function drawLabels(container: Container, view: ViewModel, bounds: LabelBounds): void {
  view.tokens.forEach((token) => addTokenLabels(container, token, bounds));
  addPathCost(container, view.pathHint, bounds);
}

/** Pastille « N PM » du survol : même conteneur que les noms, donc détruite avec eux. */
function addPathCost(container: Container, hint: PathHint | null | undefined, bounds: LabelBounds): void {
  if (hint === null || hint === undefined) return;
  const text = new Text({ text: `${hint.cost} PM`, style: pathCostStyle(hint) });
  const label = pathCostLabel({ hint, bounds, width: text.width });
  text.anchor.set(0.5);
  text.position.set(label.x, label.y);
  container.addChild(text);
}

function clearLabels(container: Container): void {
  container.removeChildren().forEach((child) => child.destroy());
}

function clearBoardLayers(layers: SceneLayers): void {
  layers.grid.clear();
  layers.decor.clear();
  layers.decorAbove.clear();
  layers.highlights.clear();
  layers.hover.clear();
  layers.path.clear();
  layers.exitMarks.clear();
  layers.teamRings.clear();
}

function clearLayers(layers: SceneLayers): void {
  clearBoardLayers(layers);
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

/** Décals plats : posés au sol, ils ne masquent jamais un acteur. */
function groundDecals(decor: readonly DecorView[]): DecorView[] {
  return layerViews(decor, "below").filter((view) => isGroundDecal(view.type));
}

/** Objets occlusifs : un nœud par objet, trié avec les acteurs par `x + y`. */
function occludingProps(decor: readonly DecorView[]): DecorView[] {
  return layerViews(decor, "below").filter((view) => !isGroundDecal(view.type));
}

/** Clé stable d'un prop : sa case projetée, son type, sa couche. Rien d'autre ne change son dessin. */
function propKey(view: DecorView): string {
  return `${view.layer}|${view.type}|${view.center.x}:${view.center.y}`;
}

/** Nœud du prop : **réutilisé** tant que la clé ne change pas (plus de churn par survol). */
function propNode(view: DecorView, cache: Map<string, Graphics>): Graphics {
  const cached = cache.get(propKey(view));
  if (cached !== undefined) return cached;
  const node = decorNode(view);
  cache.set(propKey(view), node);
  return node;
}

/** Les nœuds des props disparus sont détruits par `ActorStage` : la carte les oublie ici. */
function prunePropCache(cache: Map<string, Graphics>, views: readonly DecorView[]): void {
  const live = new Set(views.map(propKey));
  [...cache.keys()].filter((key) => !live.has(key)).forEach((key) => cache.delete(key));
}

function decorProps(decor: readonly DecorView[], cache: Map<string, Graphics>): DepthProp[] {
  const views = occludingProps(decor);
  prunePropCache(cache, views);
  return views.map((view, order) => ({ key: propKey(view), depth: view.depth, order, node: propNode(view, cache) }));
}

/**
 * Sol, décor opaque puis grille de cases : les contours restent visibles même
 * au-dessus de l'épave. Soleils de sortie, surbrillances et chemin ferment la
 * couche plateau — les soleils restent sous les jetons, donc ils ne masquent
 * ni un nom, ni une barre de PV.
 */
function drawBoardLayers(layers: SceneLayers, view: ViewModel): void {
  drawGrid(layers.grid, view.scene.tiles);
  drawDecor(layers.decor, groundDecals(view.scene.decor));
  drawOutlines(layers.grid, view.scene.outlines);
  drawExitMarks(layers.exitMarks, view.scene.exitMarks);
  drawHighlights(layers.highlights, view.scene.highlights);
  drawPath(layers.path, view.path);
  drawInvalidTarget(layers.path, view.pathHint);
}

/** Anneau d'équipe sous le sprite, anneau doré **sous** les acteurs, puis jetons, décor haut et badges. */
function drawActorLayers(layers: SceneLayers, view: ViewModel, bounds: LabelBounds): void {
  drawTeamRings(layers.teamRings, view.tokens);
  drawActiveRings(layers.tokens, view.tokens);
  drawTokens(layers.tokens, tokensNeedingCircle(view.tokens, layers.actors.sheetIds));
  drawDecor(layers.decorAbove, layerViews(view.scene.decor, "above"));
  drawLabels(layers.labels, view, bounds);
}

/**
 * Une **seule** barre de vie à l'écran : celle du jeton dont la case logique est
 * survolée (`ui-dofus-retro.md` §6 R4, §8.1). Case vide ou aucun survol ⇒ rien ;
 * l'exploration ne déclare aucune barre, donc elle reste muette quoi qu'il arrive.
 * `hoverBarInBounds` la garde dans le canvas, comme le nom et le badge.
 */
function drawFieldHpBars(layers: SceneLayers, view: ViewModel, hover: Hovered): void {
  const tokens = hoveredHpBarTokens(view.hpBarTokens, hover.cell);
  tokens.forEach((token) => paintHpBar(layers.hpBars, hoverBarInBounds(token, hover.bounds)));
}

/** Ce qu'une image peint hors du modèle : la case survolée et les bornes d'étiquettes. */
interface Hovered {
  cell: Position | null;
  bounds: LabelBounds;
}

/** Surbrillance de l'entité survolée : un seul aplat, sur la case logique du jeton. */
function drawHover(layers: SceneLayers, view: ViewModel, cell: Position | null): void {
  drawEntityHover(layers.hover, entityHover(view.tokens, cell));
}

/** Tout jeton qu'aucune feuille ne rend est peint en cercle : jamais omis, ni en combat ni en exploration. */
function drawLayers(paint: ScenePaint): void {
  const { layers, view, input, app } = paint;
  const cell = input.hoveredCell ?? null;
  const bounds = sceneLabelBounds(view, app.screen);
  drawBoardLayers(layers, view);
  drawHover(layers, view, cell);
  drawActorLayers(layers, view, bounds);
  drawFieldHpBars(layers, view, { cell, bounds });
}

/** Ce qu'un rendu doit connaître en plus de l'image : feuilles, carte et case survolée. */
export interface RenderInput {
  sheets?: readonly SpriteSheetSpec[];
  /** Carte dessinée : un changement invalide les trajets **et** les nombres en vol. */
  scene?: object | null;
  /**
   * Case sous le pointeur, telle que la frontière l'a résolue. Le rendu en déduit
   * la **seule** entité survolée ; il ne lit jamais le DOM ni un événement souris.
   */
  hoveredCell?: Position | null;
}

/** Une seule identité de carte pour les deux animations : elles s'annulent ensemble. */
function sceneOf(view: ViewModel, input: RenderInput): object | null | undefined {
  return input.scene ?? view.sceneKey;
}

/** Demande de synchronisation des acteurs : centres de cases, carte et rappel de chargement. */
function actorSyncInput(paint: ScenePaint): ActorSyncInput {
  const { app, view, input, layers } = paint;
  const centers = cellCenters(view.scene.tiles);
  const onReady = (): void => renderScene(app, view, input);
  const props = decorProps(view.scene.decor, layers.propNodes);
  return { tokens: view.tokens, onReady, centers, scene: sceneOf(view, input), props };
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

/** Une image complète : plateau, survol, acteurs puis nombres flottants, dans cet ordre. */
function paintScene(paint: ScenePaint): void {
  const { layers, view, input } = paint;
  clearLayers(layers);
  drawLayers(paint);
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
