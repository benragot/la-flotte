import type { FloatingEvent, FloatKind } from "../engine/combat";
import type { PixelPoint } from "./gridProjection";
import type { TokenView } from "./tokens";
import { hpBarFor } from "./tokens";

/** Durée d'un nombre flottant : le temps de lire un chiffre, pas plus. */
export const FLOAT_MS = 1500;
/** Course verticale sur toute la durée : le nombre s'éloigne de la cible. */
export const FLOAT_RISE_PX = 36;
/**
 * Taille du nombre : 18 px à l'échelle 1, soit ~1,6× le nom des jetons (11 px).
 * Un chiffre se lit en une fraction de seconde ; en dessous de 16 px il se
 * confond avec l'étiquette du nom, au-dessus de 20 px il masque la barre de vie.
 */
export const FLOAT_FONT_SIZE = 18;
/** Palette §1.1 : Neutre `#E8DCC8`, lisible sur le sable clair comme sur l'eau. */
export const FLOAT_DAMAGE_FILL = 0xe8dcc8;
/** Palette §1.1 : Soin `#6AD06A`, la même teinte que la barre de vie. */
export const FLOAT_HEAL_FILL = 0x6ad06a;
/** Palette §1.1 : Pierre / ardoise `#2B241D`, le contour qui tient sur les deux fonds. */
export const FLOAT_STROKE = 0x2b241d;
export const FLOAT_STROKE_WIDTH = 4;
/** Écart horizontal entre deux nombres simultanés sur la même cible. */
export const FLOAT_STACK_DX = 14;
/** Écart vertical entre deux nombres simultanés : le second monte un peu plus haut. */
export const FLOAT_STACK_DY = 7;
/** Dégagement entre le haut de la barre de vie et le nombre qui naît. */
export const FLOAT_LIFT_PX = 10;
/** Marge haute : un nombre près du sommet reste **entier** dans le canevas. */
export const FLOAT_EDGE_PADDING = FLOAT_FONT_SIZE / 2 + 2;

const FILLS: Record<FloatKind, number> = { damage: FLOAT_DAMAGE_FILL, heal: FLOAT_HEAL_FILL };

/** Libellé signé : `-8` pour un coup, `+5` pour un soin. */
export function floatLabel(kind: FloatKind, amount: number): string {
  return `${kind === "damage" ? "-" : "+"}${amount}`;
}

/** Couleur de la teinte : dégâts neutres, soin vert. */
export function floatFill(kind: FloatKind): number {
  return FILLS[kind];
}

function progress(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  return Math.min(1, Math.max(0, elapsedMs / durationMs));
}

/** Montée en pixels : la course entière est atteinte à la fin, jamais dépassée. */
export function floatRise(elapsedMs: number, durationMs: number = FLOAT_MS): number {
  return progress(elapsedMs, durationMs) * FLOAT_RISE_PX;
}

/** Opacité : de 1 à 0, linéaire — le nombre s'estompe en s'éloignant. */
export function floatAlpha(elapsedMs: number, durationMs: number = FLOAT_MS): number {
  return 1 - progress(elapsedMs, durationMs);
}

/**
 * Ordonnée peinte : la course ne sort jamais le nombre par le haut du canevas.
 * Une cible au sommet du plateau voit son `-8` s'arrêter au bord, jamais disparaître.
 */
export function floatY(originY: number, elapsedMs: number, durationMs: number = FLOAT_MS): number {
  return Math.max(FLOAT_EDGE_PADDING, originY - floatRise(elapsedMs, durationMs));
}

/** Point de naissance : au-dessus du jeton de la **cible**, pas de l'attaquant. */
export function floatOrigin(token: TokenView): PixelPoint {
  return { x: token.center.x, y: hpBarFor(token).y - FLOAT_LIFT_PX * token.scale };
}

/** Décalage du n-ième nombre d'une même cible : alternance gauche/droite, jamais superposés. */
export function stackOffset(index: number): PixelPoint {
  if (index === 0) return { x: 0, y: 0 };
  const rank = Math.ceil(index / 2);
  const side = index % 2 === 0 ? 1 : -1;
  return { x: side * rank * FLOAT_STACK_DX, y: -index * FLOAT_STACK_DY };
}

/** Nombre de nombres déjà en vol sur cette cible : sert d'index d'empilement. */
export function stackIndexFor(events: readonly FloatingEvent[], targetId: string): number {
  return events.filter((event) => event.targetId === targetId).length;
}
