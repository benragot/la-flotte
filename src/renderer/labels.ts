import type { TileView } from "./scene";
import type { TokenView } from "./tokens";
import { hpBarFor } from "./tokens";

export const LABEL_FONT_SIZE = 11;
export const LABEL_FILL = 0xf2d64b;
/** Contour sombre : le nom reste lisible sur le sable clair comme sur l'eau. */
export const LABEL_STROKE = 0x101820;
export const LABEL_STROKE_WIDTH = 3;
/** Écart entre le bas du nom et le haut de la barre de vie. */
export const LABEL_BAR_GAP = 4;
/** Marge gardée entre l'encre du nom et le bord de la carte. */
export const LABEL_EDGE_PADDING = 4;

const NAME_SEPARATOR = " · ";

export interface LabelBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface NameLabel {
  text: string;
  x: number;
  /** Bas du texte : il monte au-dessus de la barre, jamais dessus. */
  y: number;
  scale: number;
}

/** « Crabe à Clé-à-Molette · Niv. 3 » → le nom seul, entier : le niveau reste au badge. */
export function groupNameOf(label: string): string {
  return label.split(NAME_SEPARATOR)[0] ?? label;
}

/** Étiquette du nom, ancrée au-dessus de la barre de vie avec un écart constant. */
export function nameLabelFor(token: TokenView): NameLabel | null {
  if (token.name === null || token.name.length === 0) return null;
  const y = hpBarFor(token).y - LABEL_BAR_GAP * token.scale;
  return { text: token.name, x: token.center.x, y, scale: token.scale };
}

/** Borne le centre du texte pour que son encre reste dans la carte. */
export function clampLabelX(x: number, halfWidth: number, bounds: LabelBounds): number {
  const min = bounds.minX + halfWidth + LABEL_EDGE_PADDING;
  const max = bounds.maxX - halfWidth - LABEL_EDGE_PADDING;
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
