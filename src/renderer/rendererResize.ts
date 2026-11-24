import type { Application } from "pixi.js";
import { isApplicationAlive } from "./appLifecycle";
import type { GridSize } from "./gridProjection";
import { pixiResolution } from "./pixiResolution";

/** Aligne la résolution du renderer sur le DPR courant : un resize ne repasse jamais en 1×. */
function syncResolution(app: Application, devicePixelRatio: number): void {
  const resolution = pixiResolution(devicePixelRatio);
  if (app.renderer.resolution !== resolution) app.renderer.resolution = resolution;
}

/**
 * Redimensionne le canvas en **pixels CSS** (le facteur physique est porté par la
 * résolution, cf. `autoDensity`) puis redessine une image.
 */
export function resizeRenderer(app: Application, size: GridSize, devicePixelRatio: number): void {
  if (!isApplicationAlive(app)) return;
  syncResolution(app, devicePixelRatio);
  app.renderer.resize(size.width, size.height);
  app.stage.hitArea = app.screen;
  app.render();
}
