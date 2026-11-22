import { useEffect } from "react";
import type { RefObject } from "react";
import { useCombatStore } from "../store/useCombatStore";
import type { GridSize } from "./gridProjection";
import { bindHover, boardLayoutOf } from "./pointer";

export interface SceneHoverInput {
  /** L'élément qui monte le canvas : le seul endroit où un écouteur DOM a le droit de vivre. */
  host: RefObject<HTMLDivElement>;
  /** Grille de la scène peinte ; `null` quand le survol est déjà branché par PixiJS. */
  map: GridSize | null;
  viewport: GridSize;
}

/** Un canvas de secours (1×1) n'a pas de projection : on n'écoute rien. */
function isMeasured(size: GridSize): boolean {
  return size.width > 1 && size.height > 1;
}

/**
 * Survole une entité en exploration : la case survolée est écrite dans le store,
 * la peinture la reçoit en entrée. La couche de peinture ne lit jamais un
 * événement souris — l'écouteur vit ici, à la frontière du canvas.
 */
export function useSceneHover(input: SceneHoverInput): void {
  const setHoveredCell = useCombatStore((state) => state.setHoveredCell);
  const { host, map, viewport } = input;
  useEffect(() => {
    const element = host.current;
    if (map === null || element === null || !isMeasured(viewport)) return undefined;
    return bindHover({ element, layout: boardLayoutOf(map, viewport), onHover: setHoveredCell });
  }, [host, map, viewport.width, viewport.height, setHoveredCell]);
}
