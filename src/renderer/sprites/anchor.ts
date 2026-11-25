/**
 * Ancre d'un acteur : les **pieds** sur le centre du losange isométrique.
 *
 * Source unique et pure (aucun PixiJS) : `EntitySprite` s'en sert pour peindre,
 * `tokenHit.ts` pour calculer la boîte de clic. La visée ne peut donc pas
 * dériver de la peinture.
 */
export const SPRITE_ANCHOR = { x: 0.5, y: 0.85 } as const;
