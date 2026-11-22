import type { CombatState } from "../engine/combatLoop/types";
import type { GridSize } from "./gridProjection";

export const SCENE_BACKGROUND = 0x1b2430;

/** Canvas de secours avant toute scène : un canvas valide mais vide. */
export const FALLBACK_GRID: GridSize = { width: 1, height: 1 };

export interface CanvasSizeInput {
  combat: CombatState | null;
  viewport: GridSize;
  hasExploration: boolean;
}

function isUsableViewport(viewport: GridSize): boolean {
  return viewport.width > 0 && viewport.height > 0;
}

/** Taille pixel du canvas : le conteneur réel, jamais `window`. */
export function combatCanvasSize(input: CanvasSizeInput): GridSize {
  if (input.combat === null && !input.hasExploration) return FALLBACK_GRID;
  return isUsableViewport(input.viewport) ? input.viewport : FALLBACK_GRID;
}
