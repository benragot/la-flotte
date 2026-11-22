import type { CombatState } from "../engine/combatLoop/types";
import type { GridSize } from "./gridProjection";

export const SCENE_BACKGROUND = 0x1b2430;

/** Canvas de secours avant toute scène : un canvas valide mais vide. */
export const FALLBACK_GRID: GridSize = { width: 1, height: 1 };

export interface CanvasSizeInput {
  combat: CombatState | null;
  viewport: GridSize;
  hasExploration: boolean;
  /** Salle de donjon ouverte : elle a besoin d'un canvas mesuré, comme l'exploration. */
  hasBattle?: boolean;
}

function isUsableViewport(viewport: GridSize): boolean {
  return viewport.width > 0 && viewport.height > 0;
}

/** Une scène existe dès qu'un 1v1, une salle ou une exploration est ouverte. */
function hasScene(input: CanvasSizeInput): boolean {
  return input.combat !== null || input.hasExploration || input.hasBattle === true;
}

/** Taille pixel du canvas : le conteneur réel, jamais `window`. */
export function combatCanvasSize(input: CanvasSizeInput): GridSize {
  if (!hasScene(input)) return FALLBACK_GRID;
  return isUsableViewport(input.viewport) ? input.viewport : FALLBACK_GRID;
}
