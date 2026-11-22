import { Graphics } from "pixi.js";
import type { Application } from "pixi.js";
import { isApplicationAlive } from "./appLifecycle";
import type { ViewModel } from "./combatSceneModel";
import { drawGrid, drawHighlights } from "./scene";
import { drawTokens } from "./tokens";

interface SceneLayers {
  grid: Graphics;
  highlights: Graphics;
  tokens: Graphics;
}

const LAYERS = new WeakMap<Application, SceneLayers>();

function createLayers(): SceneLayers {
  return { grid: new Graphics(), highlights: new Graphics(), tokens: new Graphics() };
}

function layersFor(app: Application): SceneLayers {
  const existing = LAYERS.get(app);
  if (existing !== undefined) return existing;
  const created = createLayers();
  app.stage.addChild(created.grid, created.highlights, created.tokens);
  LAYERS.set(app, created);
  return created;
}

function clearLayers(layers: SceneLayers): void {
  layers.grid.clear();
  layers.highlights.clear();
  layers.tokens.clear();
}

function drawLayers(layers: SceneLayers, view: ViewModel): void {
  drawGrid(layers.grid, view.scene.tiles);
  drawHighlights(layers.highlights, view.scene.highlights);
  drawTokens(layers.tokens, view.tokens);
}

/** Redessine la scène ; no-op immédiat si l'application a été détruite. */
export function renderScene(app: Application, view: ViewModel): void {
  if (!isApplicationAlive(app)) return;
  const layers = layersFor(app);
  clearLayers(layers);
  drawLayers(layers, view);
  app.render();
}
