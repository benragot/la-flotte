import type { Application, Container, FederatedPointerEvent } from "pixi.js";
import type { Position } from "../engine/grid";
import { isApplicationAlive } from "./appLifecycle";
import type { IsoOrigin, PixelPoint } from "./gridProjection";
import { isoToGrid } from "./gridProjection";
import { cellKey } from "./scene";

/** Grille + origine de projection : l'inverse exact de `gridToIso`. */
export interface BoardLayout {
  width: number;
  height: number;
  origin: IsoOrigin;
}

export interface PointerHandlers {
  setHoveredCell: (position: Position | null) => void;
  clickCell: (position: Position) => void;
}

/** Case sous le curseur, `null` hors du losange de la carte. */
export function cellFromPointer(global: PixelPoint, layout: BoardLayout): Position | null {
  return isoToGrid({ px: global.x, py: global.y, origin: layout.origin, width: layout.width, height: layout.height });
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

function attachMove(stage: Container, layout: BoardLayout, onMove: PointerHandlers["setHoveredCell"]): void {
  const track = createHoverTracker(onMove);
  stage.on("pointermove", (event: FederatedPointerEvent) => track(cellFromPointer(event.global, layout)));
}

function tapCell(event: FederatedPointerEvent, layout: BoardLayout, onClick: PointerHandlers["clickCell"]): void {
  const cell = cellFromPointer(event.global, layout);
  if (cell === null) return;
  onClick(cell);
}

function attachTap(stage: Container, layout: BoardLayout, onClick: PointerHandlers["clickCell"]): void {
  stage.on("pointertap", (event: FederatedPointerEvent) => tapCell(event, layout, onClick));
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
export function bindPointer(app: Application, layout: BoardLayout, handlers: PointerHandlers): () => void {
  if (!isApplicationAlive(app)) return () => undefined;
  const stage = prepareStage(app);
  attachMove(stage, layout, handlers.setHoveredCell);
  attachTap(stage, layout, handlers.clickCell);
  attachLeave(stage, handlers.setHoveredCell);
  return () => detach(stage);
}
