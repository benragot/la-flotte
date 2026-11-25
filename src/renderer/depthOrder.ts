import type { Position } from "../engine/grid";

/**
 * Profondeur isométrique d'une case : `x + y`, l'axe que les tuiles peignent
 * déjà (`scene.ts`, `painterOrder`). Aucune case praticable n'est surélevée :
 * le relief des murs (`WALL_HEIGHT`) ne porte ni acteur ni décor, il n'ajoute
 * donc aucun axe vertical au tri.
 */
export function depthOf(position: Position): number {
  return position.x + position.y;
}

/** Objet trié par profondeur : un acteur, un jeton ou un nœud de décor. */
export interface DepthItem {
  depth: number;
  /** Rang de pose à profondeur égale : plus petit = peint en premier. */
  order: number;
}

/**
 * Départage documenté : `depth` croissant, puis `order` croissant. L'appelant
 * pose le décor avant les acteurs, donc un acteur sur la case d'un décor reste
 * visible ; à rang égal, le tri stable conserve l'ordre d'entrée.
 */
export function compareDepth(a: DepthItem, b: DepthItem): number {
  return a.depth - b.depth || a.order - b.order;
}

/** Copie triée : la liste reçue n'est jamais mutée. */
export function depthOrder<T extends DepthItem>(items: readonly T[]): T[] {
  return [...items].sort(compareDepth);
}
