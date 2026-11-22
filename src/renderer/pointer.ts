import type { Application, Container, FederatedPointerEvent } from "pixi.js";
import type { Position } from "../engine/grid";
import { isApplicationAlive } from "./appLifecycle";
import type { GridSize, PixelPoint } from "./gridProjection";
import { pixelToGrid } from "./gridProjection";
import { cellKey } from "./scene";

export interface PointerHandlers {
  setHoveredCell: (position: Position | null) => void;
  clickCell: (position: Position) => void;
}

/** Case sous le curseur, `null` hors de la grille. */
export function cellFromPointer(global: PixelPoint, size: GridSize): Position | null {
  return pixelToGrid(global, size);
}

function createHoverTracker(onMove: PointerHandlers["setHoveredCell"]): (cell: Position | null) => void {
  let last: string | null = null;
  return (cell) => {
    const key = cell === null ? null : cellKey(cell);
    if (key === last) return;
    last = key;
    onMove(cell);
  };
}

function attachMove(stage: Container, size: GridSize, onMove: PointerHandlers["setHoveredCell"]): void {
  const track = createHoverTracker(onMove);
  stage.on("pointermove", (event: FederatedPointerEvent) => track(cellFromPointer(event.global, size)));
}

function tapCell(event: FederatedPointerEvent, size: GridSize, onClick: PointerHandlers["clickCell"]): void {
  const cell = cellFromPointer(event.global, size);
  if (cell === null) return;
  onClick(cell);
}

function attachTap(stage: Container, size: GridSize, onClick: PointerHandlers["clickCell"]): void {
  stage.on("pointertap", (event: FederatedPointerEvent) => tapCell(event, size, onClick));
}

function attachLeave(stage: Container, onLeave: PointerHandlers["setHoveredCell"]): void {
  stage.on("pointerleave", () => onLeave(null));
}

function prepareStage(app: Application): Container {
  const stage = app.stage;
  stage.eventMode = "static";
  stage.hitArea = app.screen;
  return stage;
}

function detach(stage: Container): void {
  stage.off("pointermove");
  stage.off("pointerleave");
  stage.off("pointertap");
}

/** Branche survol, sortie et clic sur la scène PixiJS, retourne la fonction de détachement. */
export function bindPointer(app: Application, size: GridSize, handlers: PointerHandlers): () => void {
  if (!isApplicationAlive(app)) return () => undefined;
  const stage = prepareStage(app);
  attachMove(stage, size, handlers.setHoveredCell);
  attachTap(stage, size, handlers.clickCell);
  attachLeave(stage, handlers.setHoveredCell);
  return () => detach(stage);
}
