import type { SpriteAnimationName } from "./types";

/** Durée du flash d'une action, en ms : visible, jamais bloquante (200–300 ms). */
export const ACTION_EFFECT_MS = 240;

/** Aucune multiplication de couleur : le sprite retrouve sa teinte d'origine. */
export const NEUTRAL_TINT = 0xffffff;

/** `#F2D64B` (case survolée) : l'attaquant s'allume brièvement. */
const ATTACK_TINT = 0xf2d64b;

/** `#D64545` (cerclage ennemi) : la cible reçoit un flash rouge, jamais un voile. */
const HIT_TINT = 0xd64545;

/** Teinte brève d'une action ; `null` pour `idle` et `walk`, qui n'en portent pas. */
export function actionTint(animation: SpriteAnimationName): number | null {
  if (animation === "attack") return ATTACK_TINT;
  if (animation === "hit") return HIT_TINT;
  return null;
}
