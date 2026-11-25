import type { Application, Container, FederatedPointerEvent } from "pixi.js";
import type { Position } from "../engine/grid";
import { isApplicationAlive } from "./appLifecycle";
import type { GridSize, IsoOrigin, PixelPoint } from "./gridProjection";
import { isoToGrid, sceneOrigin } from "./gridProjection";
import { cellKey } from "./scene";

/**
 * Grille + origine de projection : l'inverse exact de `gridToIso`. L'échelle
 * « cover » voyage dans l'origine, donc le clic est bien divisé par elle.
 */
export interface BoardLayout {
  width: number;
  height: number;
  origin: IsoOrigin;
}

export interface PointerHandlers {
  setHoveredCell: (position: Position | null) => void;
  clickCell: (position: Position) => void;
  /**
   * Jeton sous le curseur : il passe **avant** la case. `null` (ou absent) fait
   * retomber le clic sur `isoToGrid`, donc une case vide garde son geste.
   */
  pickCell?: CellPicker;
}

/** Résolution d'un point écran en case cible : les jetons d'abord, la grille ensuite. */
export type CellPicker = (point: PixelPoint) => Position | null;

/** Entrée d'un tap : le point, la projection de la scène et le picker de jetons. */
export interface TapInput {
  point: PixelPoint;
  layout: BoardLayout;
  pick?: CellPicker;
}

/**
 * Case d'un clic ou d'un tap : le **jeton** sous le curseur d'abord (il est peint
 * au-dessus de sa case), la case de la grille sinon. Sans picker, le
 * comportement historique est conservé à l'identique.
 */
export function cellAtTap(input: TapInput): Position | null {
  return input.pick?.(input.point) ?? cellFromPointer(input.point, input.layout);
}

/** Case sous le curseur, `null` hors du losange de la carte. */
export function cellFromPointer(global: PixelPoint, layout: BoardLayout): Position | null {
  return isoToGrid({ px: global.x, py: global.y, origin: layout.origin, width: layout.width, height: layout.height });
}

/**
 * Grille + origine de projection d'une scène : exactement ce que la peinture
 * reçoit. Le survol d'exploration passe par ici, comme le clic de combat — donc
 * une seule projection pour viser et pour peindre.
 */
export function boardLayoutOf(map: GridSize, viewport: GridSize): BoardLayout {
  return { ...map, origin: sceneOrigin(map, viewport) };
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

function tapCell(event: FederatedPointerEvent, layout: BoardLayout, handlers: PointerHandlers): void {
  const point = { x: event.global.x, y: event.global.y };
  const cell = cellAtTap({ point, layout, pick: handlers.pickCell });
  if (cell !== null) handlers.clickCell(cell);
}

function attachTap(stage: Container, layout: BoardLayout, handlers: PointerHandlers): void {
  stage.on("pointertap", (event: FederatedPointerEvent) => tapCell(event, layout, handlers));
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
  attachTap(stage, layout, handlers);
  attachLeave(stage, handlers.setHoveredCell);
  return () => detach(stage);
}

/** Ce qu'un survol DOM doit connaître : l'élément qui monte le canvas et sa projection. */
export interface HoverBindingInput {
  element: HTMLElement;
  layout: BoardLayout;
  onHover: (position: Position | null) => void;
}

type PointerListener = (event: PointerEvent) => void;

/** Coordonnée du pointeur ramenée dans le canvas, puis case de la même projection. */
function cellAtEvent(event: PointerEvent, element: HTMLElement, layout: BoardLayout): Position | null {
  const rect = element.getBoundingClientRect();
  return cellFromPointer({ x: event.clientX - rect.left, y: event.clientY - rect.top }, layout);
}

function detachHover(element: HTMLElement, move: PointerListener, leave: PointerListener): () => void {
  return () => {
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerleave", leave);
  };
}

/**
 * Survole une scène **sans combat** (l'exploration) : le renderer PixiJS n'y
 * branche pas son pointeur, c'est donc l'élément qui monte le canvas qui écrit
 * la case. Aucun clic : il reste aux hooks existants, un seul auteur par geste.
 */
export function bindHover(input: HoverBindingInput): () => void {
  const { element, layout, onHover } = input;
  const track = createHoverTracker(onHover);
  const move = (event: PointerEvent): void => track(cellAtEvent(event, element, layout));
  const leave = (): void => track(null);
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerleave", leave);
  return detachHover(element, move, leave);
}

