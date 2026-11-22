import type { GridSize } from "./gridProjection";

/** Viewport neutre tant que le conteneur n'a pas été mesuré. */
export const INITIAL_VIEWPORT: GridSize = { width: 1, height: 1 };

/** Mesure le contenu d'un élément, `null` s'il n'est pas rendu ou mesurable. */
export function measureElement(element: HTMLElement | null): GridSize | null {
  if (element === null) return null;
  const width = element.clientWidth;
  const height = element.clientHeight;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}
