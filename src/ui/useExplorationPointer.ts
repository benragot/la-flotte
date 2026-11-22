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
  const { exploration } = useCombatStore.getState();
  if (exploration === null) return null;
  const input = { exploration, viewport: viewportOf(element) };
  return cellAtPoint({ ...input, point: pointerPoint(event, element) });
}

function onClick(event: PointerEvent, element: HTMLElement): void {
  const cell = cellFromEvent(event, element);
  if (cell === null) return;
  useCombatStore.getState().clickCell(cell);
}

function bindClick(element: HTMLElement, click: (event: PointerEvent) => void): () => void {
  element.addEventListener("click", click);
  return () => element.removeEventListener("click", click);
}

/**
 * En exploration, le renderer ne branche pas son pointeur (pas de combat) :
 * l'UI traduit le clic en case via la même projection iso. Aucun survol n'est
 * suivi depuis #51 : pas d'aperçu de chemin, et le seul retour au clic est la
 * ligne de journal écrite par `clickCell` (« Le chemin est bloqué » ou
 * « Le héros se déplace »). La grille visible appartient à la PR décor.
 */
export function useExplorationPointer(host: RefObject<HTMLElement>): void {
  const mode = useCombatStore((state) => state.mode);
  useEffect(() => {
    const element = host.current;
    if (mode !== "exploration" || element === null) return undefined;
    return bindClick(element, (event: PointerEvent) => onClick(event, element));
  }, [mode, host]);
}
