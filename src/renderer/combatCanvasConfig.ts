import type { CombatState } from "../engine/combatLoop/types";
import type { GridSize } from "./gridProjection";
import { canvasSize } from "./gridProjection";

export const SCENE_BACKGROUND = 0x1b2430;

/** Grille de secours avant le premier combat : un canvas valide mais vide. */
export const FALLBACK_GRID: GridSize = { width: 1, height: 1 };

/** Taille pixel du canvas, dérivée de la carte en cours. */
export function combatCanvasSize(combat: CombatState | null): GridSize {
  if (combat === null) return canvasSize(FALLBACK_GRID);
  return canvasSize(combat.map);
}
