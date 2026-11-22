import { Container, Graphics, Text } from "pixi.js";
import type { Application } from "pixi.js";
import { isApplicationAlive } from "./appLifecycle";
import type { ViewModel } from "./combatSceneModel";
import { drawGrid, drawHighlights, drawPath } from "./tilePaint";
import type { TokenBadge, TokenView } from "./tokens";
import { drawTokens, tokenBadge } from "./tokens";

interface SceneLayers {
  grid: Graphics;
  highlights: Graphics;
  path: Graphics;
  tokens: Graphics;
  labels: Container;
}

export const BADGE_FONT_SIZE = 11;
export const BADGE_TEXT_COLOR = 0xf2d64b;

const LAYERS = new WeakMap<Application, SceneLayers>();

function createLayers(): SceneLayers {
  return {
    grid: new Graphics(),
    highlights: new Graphics(),
    path: new Graphics(),
    tokens: new Graphics(),
    labels: new Container(),
  };
}

function layersFor(app: Application): SceneLayers {
  const existing = LAYERS.get(app);
  if (existing !== undefined) return existing;
  const created = createLayers();
  app.stage.addChild(created.grid, created.highlights, created.path, created.tokens, created.labels);
  LAYERS.set(app, created);
  return created;
}

function createLabel(badge: TokenBadge): Text {
  const label = new Text({ text: badge.text, style: { fontSize: BADGE_FONT_SIZE, fill: BADGE_TEXT_COLOR } });
  label.anchor.set(0.5);
  label.position.set(badge.x, badge.y);
  return label;
}

function addLabel(container: Container, token: TokenView): void {
  const badge = tokenBadge(token);
  if (badge === null) return;
  container.addChild(createLabel(badge));
}

function drawLabels(container: Container, tokens: readonly TokenView[]): void {
  tokens.forEach((token) => addLabel(container, token));
}

function clearLabels(container: Container): void {
  container.removeChildren().forEach((child) => child.destroy());
}

function clearLayers(layers: SceneLayers): void {
  layers.grid.clear();
  layers.highlights.clear();
  layers.path.clear();
  layers.tokens.clear();
  clearLabels(layers.labels);
}

function drawLayers(layers: SceneLayers, view: ViewModel): void {
  drawGrid(layers.grid, view.scene.tiles);
  drawHighlights(layers.highlights, view.scene.highlights);
  drawPath(layers.path, view.path);
  drawTokens(layers.tokens, view.tokens);
  drawLabels(layers.labels, view.tokens);
}

/** Redessine la scène ; no-op immédiat si l'application a été détruite. */
export function renderScene(app: Application, view: ViewModel): void {
  if (!isApplicationAlive(app)) return;
  const layers = layersFor(app);
  clearLayers(layers);
  drawLayers(layers, view);
  app.render();
}
