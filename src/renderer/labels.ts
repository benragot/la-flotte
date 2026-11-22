import type { TileView } from "./scene";
import type { TokenView } from "./tokens";
import { BADGE_RADIUS, hpBarFor } from "./tokens";

export const LABEL_FONT_SIZE = 11;
export const LABEL_FILL = 0xf2d64b;
/** Contour sombre : le nom reste lisible sur le sable clair comme sur l'eau. */
export const LABEL_STROKE = 0x101820;
export const LABEL_STROKE_WIDTH = 3;
/** Écart entre le bas du nom et le haut de la barre de vie. */
export const LABEL_BAR_GAP = 4;
/** Marge gardée entre l'encre du nom et le bord de la carte. */
export const LABEL_EDGE_PADDING = 4;
/** Écart entre le nom et le badge de niveau, tous deux dans la bande haute. */
export const LABEL_BADGE_GAP = 4;

const NAME_SEPARATOR = " · ";

export interface LabelBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface TokenLabel {
  text: string;
  x: number;
  y: number;
  scale: number;
}

/** « Crabe à Clé-à-Molette · Niv. 3 » → le nom seul, entier : le niveau reste au badge. */
export function groupNameOf(label: string): string {
  return label.split(NAME_SEPARATOR)[0] ?? label;
}

/** Étiquette du nom, ancrée au-dessus de la barre de vie avec un écart constant. */
export function nameLabelFor(token: TokenView): TokenLabel | null {
  if (token.name === null || token.name.length === 0) return null;
  const y = hpBarFor(token).y - LABEL_BAR_GAP * token.scale;
  return { text: token.name, x: token.center.x, y, scale: token.scale };
}

function badgeGap(token: TokenView): number {
  return (LABEL_BADGE_GAP + BADGE_RADIUS) * token.scale;
}

function badgeAnchor(token: TokenView, nameWidth: number): { x: number; y: number } {
  const bar = hpBarFor(token);
  const name = nameLabelFor(token);
  if (name === null) return { x: bar.x + bar.width + badgeGap(token), y: bar.y + bar.height / 2 };
  const y = name.y - (LABEL_FONT_SIZE * token.scale) / 2;
  return { x: name.x + nameWidth / 2 + badgeGap(token), y };
}

/** Badge de niveau : à droite du nom, jamais sur le corps du personnage. */
export function badgeLabelFor(token: TokenView, nameWidth: number): TokenLabel | null {
  if (token.badge === null || token.badge.length === 0) return null;
  const { x, y } = badgeAnchor(token, nameWidth);
  return { text: token.badge, x, y, scale: token.scale };
}

function isLabel(label: TokenLabel | null): label is TokenLabel {
  return label !== null;
}

/** Tous les textes d'un jeton, avec leur position : nom complet puis badge. */
export function tokenLabelsFor(token: TokenView, nameWidth: number): TokenLabel[] {
  const labels = [nameLabelFor(token), badgeLabelFor(token, nameWidth)];
  return labels.filter(isLabel);
}

/** Place à réserver à droite du nom pour que le badge tienne dans la carte. */
export function badgeReserve(token: TokenView): number {
  return token.badge === null ? 0 : (2 * BADGE_RADIUS + LABEL_BADGE_GAP) * token.scale;
}

export interface ClampInput {
  x: number;
  halfWidth: number;
  bounds: LabelBounds;
  /** Place réservée à droite, pour que le badge reste dans la carte. */
  rightReserve?: number;
}

/** Borne le centre du texte pour que son encre reste dans la carte. */
export function clampLabelX(input: ClampInput): number {
  const { x, halfWidth, bounds, rightReserve = 0 } = input;
  const min = bounds.minX + halfWidth + LABEL_EDGE_PADDING;
  const max = bounds.maxX - halfWidth - LABEL_EDGE_PADDING - rightReserve;
  if (min > max) return (bounds.minX + bounds.maxX) / 2;
  return Math.min(max, Math.max(min, x));
}

function abscissas(tile: TileView): number[] {
  return tile.points.filter((_, index) => index % 2 === 0);
}

function ordinates(tile: TileView): number[] {
  return tile.points.filter((_, index) => index % 2 === 1);
}

function span(values: readonly number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

/** Boîte d'encre de la carte, déduite des losanges : c'est la limite des étiquettes. */
export function labelBounds(tiles: readonly TileView[]): LabelBounds | null {
  const xs = tiles.flatMap(abscissas);
  const ys = tiles.flatMap(ordinates);
  if (xs.length === 0 || ys.length === 0) return null;
  const [minX, maxX] = span(xs);
  const [minY, maxY] = span(ys);
  return { minX, maxX, minY, maxY };
}
