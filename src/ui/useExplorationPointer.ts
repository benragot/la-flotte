import { useEffect } from "react";
import type { RefObject } from "react";
import type { Position } from "../engine/grid";
import type { GridSize } from "../renderer";
import { useCombatStore } from "../store/useCombatStore";
import { cellAtPoint } from "./explorationView";

interface PixelPoint {
  x: number;
  y: number;
}

function pointerPoint(event: PointerEvent, element: HTMLElement): PixelPoint {
  const rect = element.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function viewportOf(element: HTMLElement): GridSize {
  return { width: element.clientWidth, height: element.clientHeight };
}

function cellFromEvent(event: PointerEvent, element: HTMLElement): Position | null {
  const { exploration, hoveredCell } = useCombatStore.getState();
  if (exploration === null) return null;
  const input = { exploration, hoveredCell, viewport: viewportOf(element) };
  return cellAtPoint({ ...input, point: pointerPoint(event, element) });
}

function onClick(event: PointerEvent, element: HTMLElement): void {
  const cell = cellFromEvent(event, element);
  if (cell === null) return;
  useCombatStore.getState().clickCell(cell);
}

function onMove(event: PointerEvent, element: HTMLElement): void {
  useCombatStore.getState().setHoveredCell(cellFromEvent(event, element));
}

function bind(element: HTMLElement, click: (event: PointerEvent) => void, move: (event: PointerEvent) => void) {
  element.addEventListener("click", click);
  element.addEventListener("pointermove", move);
  return () => {
    element.removeEventListener("click", click);
    element.removeEventListener("pointermove", move);
  };
}

/**
 * En exploration, le renderer ne branche pas son pointeur (pas de combat) :
 * l'UI traduit le point cliqué en case via la même projection iso.
 */
export function useExplorationPointer(host: RefObject<HTMLElement>): void {
  const mode = useCombatStore((state) => state.mode);
  useEffect(() => {
    const element = host.current;
    if (mode !== "exploration" || element === null) return undefined;
    const click = (event: PointerEvent) => onClick(event, element);
    const move = (event: PointerEvent) => onMove(event, element);
    return bind(element, click, move);
  }, [mode, host]);
}
