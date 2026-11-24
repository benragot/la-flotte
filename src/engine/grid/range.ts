import type { Position } from "./asciiMap";

/**
 * Distance de portée d'un sort : **Chebyshev** `max(|dx|, |dy|)`, la métrique de
 * Dofus 1.29. Une diagonale adjacente vaut 1 : les huit voisins sont touchables
 * à portée 1, et `minRange` se mesure de la même façon. Ce n'est pas la facture
 * de déplacement : DEC-10 continue de facturer 2 PM la diagonale (`stepCost`).
 */
export function rangeDistance(from: Position, to: Position): number {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  return Math.max(dx, dy);
}
