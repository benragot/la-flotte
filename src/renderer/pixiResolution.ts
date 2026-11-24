/** En deçà d'un écran standard, on ne rend jamais sous le pixel CSS. */
export const MIN_PIXEL_RATIO = 1;

/** Plafond : au-delà de ×3, le surcoût GPU dépasse le gain de netteté perçu. */
export const MAX_PIXEL_RATIO = 3;

export interface PixiInitOptions {
  resolution: number;
  autoDensity: true;
}

/**
 * Résolution de rendu déduite du DPR : sans elle, PixiJS crée un canvas 1× que
 * le navigateur agrandit, et noms, liserés et sprites deviennent flous sur Retina.
 * Un DPR absent, nul, négatif ou infini retombe sur 1× plutôt que de casser le rendu.
 */
export function pixiResolution(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio)) return MIN_PIXEL_RATIO;
  return Math.min(Math.max(devicePixelRatio, MIN_PIXEL_RATIO), MAX_PIXEL_RATIO);
}

/**
 * Options d'initialisation PixiJS : `resolution` pour la netteté physique,
 * `autoDensity` pour que la taille du canvas reste exprimée en **pixels CSS**
 * (le hit-test de `isoToGrid` ne change donc pas).
 */
export function pixiInitOptions(devicePixelRatio: number): PixiInitOptions {
  return { resolution: pixiResolution(devicePixelRatio), autoDensity: true };
}
