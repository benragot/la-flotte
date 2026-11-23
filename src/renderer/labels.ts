import { TILE_H } from "./gridProjection";
import type { TileView } from "./scene";
import type { HpBar, TokenView } from "./tokens";
import { BADGE_RADIUS, hpBarFor } from "./tokens";

export const LABEL_FONT_SIZE = 11;
/** Or du badge de niveau ; le nom, lui, prend `NAME_LABEL_FILL` (§5). */
export const LABEL_FILL = 0xf2d64b;
/** Nom au-dessus de la tête (§5) : `#E8DCC8` à α 0.9, jamais l'or du badge. */
export const NAME_LABEL_FILL = 0xe8dcc8;
export const NAME_LABEL_ALPHA = 0.9;
/** Hauteur du nom au-dessus du centre bas du losange, en tuiles (§5). */
export const NAME_LIFT_TILES = 2.2;
/** Contour sombre : le nom reste lisible sur le sable clair comme sur l'eau. */
export const LABEL_STROKE = 0x101820;
export const LABEL_STROKE_WIDTH = 3;
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
  kind: "name" | "badge";
  text: string;
  x: number;
  y: number;
  scale: number;
}

export interface LabelsInput {
  token: TokenView;
  bounds: LabelBounds;
  /** Largeur mesurée par Pixi : elle seule évite que nom et badge divergent. */
  nameWidth: number;
  /** Hauteur mesurée par Pixi ; à défaut la taille de police (§5) sert d'encre. */
  nameHeight?: number;
}

/** « Crabe à Clé-à-Molette · Niv. 3 » → le nom seul, entier : le niveau reste au badge. */
export function groupNameOf(label: string): string {
  return label.split(NAME_SEPARATOR)[0] ?? label;
}

/** Étiquette du nom : 11 px, à `-2.2 × TILE_H` du centre bas du losange (§5). */
export function nameLabelFor(token: TokenView): TokenLabel | null {
  if (token.name === null || token.name.length === 0) return null;
  const y = token.center.y - TILE_H * NAME_LIFT_TILES * token.scale;
  return { kind: "name", text: token.name, x: token.center.x, y, scale: token.scale };
}

function badgeGap(token: TokenView): number {
  return (LABEL_BADGE_GAP + BADGE_RADIUS) * token.scale;
}

/** Hauteur d'encre du nom : mesurée par Pixi, sinon la taille de police (§5). */
function nameInkHeight(input: LabelsInput): number {
  return input.nameHeight ?? LABEL_FONT_SIZE * input.token.scale;
}

function clampedName(input: LabelsInput): TokenLabel | null {
  const name = nameLabelFor(input.token);
  if (name === null) return null;
  const x = clampLabelX({ x: name.x, halfWidth: input.nameWidth / 2, bounds: input.bounds, rightReserve: badgeReserve(input.token) });
  const y = clampLabelY({ y: name.y, height: nameInkHeight(input), bounds: input.bounds, anchorY: 1 });
  return { ...name, x, y };
}

function badgeAnchor(input: LabelsInput, name: TokenLabel | null): { x: number; y: number } {
  const bar = hpBarFor(input.token);
  if (name === null) return fallbackBadgeAnchor(input, bar);
  const y = name.y - (LABEL_FONT_SIZE * input.token.scale) / 2;
  return { x: name.x + input.nameWidth / 2 + badgeGap(input.token), y };
}

function fallbackBadgeAnchor(input: LabelsInput, bar: { x: number; y: number; width: number; height: number }): { x: number; y: number } {
  const halfWidth = BADGE_RADIUS * input.token.scale;
  const x = bar.x + bar.width + badgeGap(input.token);
  return { x: clampLabelX({ x, halfWidth, bounds: input.bounds }), y: bar.y + bar.height / 2 };
}

function badgeFrom(input: LabelsInput, name: TokenLabel | null): TokenLabel | null {
  if (input.token.badge === null || input.token.badge.length === 0) return null;
  const { x, y } = badgeAnchor(input, name);
  const height = 2 * BADGE_RADIUS * input.token.scale;
  return { kind: "badge", text: input.token.badge, x, y: clampLabelY({ y, height, bounds: input.bounds, anchorY: 0.5 }), scale: input.token.scale };
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

export interface ClampYInput {
  /** Ancre verticale, telle que Pixi la reçoit (`anchor.y`). */
  y: number;
  /** Hauteur d'encre de l'élément : la borne doit la compter, sinon le texte dépasse. */
  height: number;
  bounds: LabelBounds;
  /** Position de l'ancre **dans** son encre : 0 = haut, 0.5 = centre, 1 = bas. */
  anchorY?: number;
}

/**
 * Décision commune au nom, au badge et à la barre : c'est le **haut de l'encre**
 * qui est borné (symétrique de `clampLabelX`), puis l'ancre est reconstruite par
 * la hauteur. Borner l'ancre seule laisserait déborder d'autant de pixels que
 * l'élément est haut.
 */
export function clampLabelY(input: ClampYInput): number {
  const { y, height, bounds, anchorY = 0 } = input;
  return clampLabelTop(y - height * anchorY, height, bounds) + height * anchorY;
}

/** Réglage symétrique de `clampLabelX` : marge, et centrage si les bornes sont plus courtes que l'encre. */
function clampLabelTop(top: number, height: number, bounds: LabelBounds): number {
  const min = bounds.minY + LABEL_EDGE_PADDING;
  const max = bounds.maxY - height - LABEL_EDGE_PADDING;
  if (min > max) return (bounds.minY + bounds.maxY - height) / 2;
  return Math.min(max, Math.max(min, top));
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

/** Boîte d'encre de la carte, déduite des losanges. */
export function labelBounds(tiles: readonly TileView[]): LabelBounds | null {
  const xs = tiles.flatMap(abscissas);
  const ys = tiles.flatMap(ordinates);
  if (xs.length === 0 || ys.length === 0) return null;
  const [minX, maxX] = span(xs);
  const [minY, maxY] = span(ys);
  return { minX, maxX, minY, maxY };
}

/**
 * Décision : les étiquettes sont de l'UI **écran**, donc la limite est le
 * viewport. L'encre de la carte déborde le canvas de `(w+h)/(w+h−2)` (~9 % en
 * 12×12, ~46 px par côté à 1024 px) : la prendre pour borne rognerait le texte.
 */
export function viewportBounds(bounds: LabelBounds, viewport: { width: number; height: number }): LabelBounds {
  return {
    minX: Math.max(bounds.minX, 0),
    maxX: Math.min(bounds.maxX, viewport.width),
    minY: Math.max(bounds.minY, 0),
    maxY: Math.min(bounds.maxY, viewport.height),
  };
}

function isLabel(label: TokenLabel | null): label is TokenLabel {
  return label !== null;
}

/** Barre de survol bornée : elle passe par le **même** `clampLabelY` que nom et badge. */
export function hoverBarInBounds(token: TokenView, bounds: LabelBounds): HpBar {
  const bar = hpBarFor(token);
  return { ...bar, y: clampLabelY({ y: bar.y, height: bar.height, bounds }) };
}

/** Toutes les étiquettes d'un jeton, nom et badge bornés ensemble par le même x rendu. */
export function labelsFor(input: LabelsInput): TokenLabel[] {
  const name = clampedName(input);
  const badge = badgeFrom(input, name);
  const labels: (TokenLabel | null)[] = name === null ? [badge] : [name, badge];
  return labels.filter(isLabel);
}
