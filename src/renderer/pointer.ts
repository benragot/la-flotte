import type { Application, Container, FederatedPointerEvent } from "pixi.js";
import type { Position } from "../engine/grid";
import type { GridSize, PixelPoint } from "./gridProjection";
import { pixelToGrid } from "./gridProjection";

export interface PointerHandlers {
  setHoveredCell: (position: Position | null) => void;
  clickCell: (position: Position) => void;
}

/** Case sous le curseur, `null` hors de la grille. */
export function cellFromPointer(global: PixelPoint, size: GridSize): Position | null {
  return pixelToGrid(global, size);
}

function attachMove(stage: Container, size: GridSize, onMove: PointerHandlers["setHoveredCell"]): void {
  let last: string | null = null;
  stage.on("pointermove", (event: FederatedPointerEvent) => {
    const cell = cellFromPointer(event.global, size);
    const key = cell === null ? null : `${cell.x}:${cell.y}`;
    if (key === last) return;
    last = key;
    onMove(cell);
  });
}

function tapCell(event: FederatedPointerEvent, size: GridSize, onClick: PointerHandlers["clickCell"]): void {
  const cell = cellFromPointer(event.global, size);
  if (cell === null) return;
  onClick(cell);
}

function attachTap(stage: Container, size: GridSize, onClick: PointerHandlers["clickCell"]): void {
  stage.on("pointertap", (event: FederatedPointerEvent) => tapCell(event, size, onClick));
}

function detach(stage: Container): void {
  stage.off("pointermove");
  stage.off("pointertap");
}

/** Branche survol et clic sur la scène PixiJS, retourne la fonction de détachement. */
export function bindPointer(app: Application, size: GridSize, handlers: PointerHandlers): () => void {
  const stage = app.stage;
  stage.eventMode = "static";
  stage.hitArea = app.screen;
  attachMove(stage, size, handlers.setHoveredCell);
  attachTap(stage, size, handlers.clickCell);
  return () => detach(stage);
}
