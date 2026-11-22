import type { Graphics } from "pixi.js";
import type { Position } from "../engine/grid";
import type { PixelPoint } from "./gridProjection";
import { TILE_H, TILE_W, diamondPoints } from "./gridProjection";
import { cellKey } from "./scene";
import { HOVER_STROKE } from "./tileStyle";
import type { TokenView } from "./tokens";

/**
 * Surbrillance de l'entité survolée. Teinte **« case survolée »** de la palette
 * 1.29 (`ui-dofus-retro.md` §3.2, or `#F2D64B`) : le canvas parle déjà cette
 * couleur pour le contour de case, la surbrillance d'entité la reprend en aplat.
 */
export const ENTITY_HOVER_COLOR = HOVER_STROKE;

/**
 * Aplat volontairement très faible (0,12) : le propriétaire veut « légèrement
 * highlight ». Aucune animation, aucun halo : une entité se devine, elle ne
 * clignote pas. Le reste de la carte n'est jamais assombri.
 */
export const ENTITY_HOVER_ALPHA = 0.12;

/**
 * Liseré fin, même or. Un aplat seul à 0,12 disparaît sur le sable clair (la
 * spec signale déjà que le sable écrase les acteurs) : le trait garantit que le
 * survol se **lit** sans éclairer la case comme un projecteur.
 */
export const ENTITY_HOVER_STROKE_WIDTH = 1.5;
export const ENTITY_HOVER_STROKE_ALPHA = 0.55;

/** Losange de la case d'une entité, prêt pour `graphics.poly`. */
export interface EntityHover {
  /** Case **logique** survolée, celle du moteur — jamais une case recalculée. */
  cell: Position;
  points: number[];
  /** Échelle caméra : le liseré suit le décor comme les contours de grille. */
  scale: number;
}

function diamondAt(center: PixelPoint, scale: number): number[] {
  return diamondPoints(center, { x: (TILE_W / 2) * scale, y: (TILE_H / 2) * scale });
}

function markFor(token: TokenView): EntityHover {
  return { cell: token.cell, points: diamondAt(token.center, token.scale), scale: token.scale };
}

/**
 * La **seule** surbrillance d'entité de la scène : le premier jeton dont la
 * position logique est la case survolée. Case vide ou aucun survol ⇒ liste vide,
 * jamais `undefined` — une seule entité survolée à la fois.
 */
export function entityHover(tokens: readonly TokenView[], cell: Position | null): EntityHover[] {
  if (cell === null) return [];
  const key = cellKey(cell);
  const hovered = tokens.find((token) => cellKey(token.cell) === key);
  return hovered === undefined ? [] : [markFor(hovered)];
}

function paintHover(graphics: Graphics, mark: EntityHover): void {
  graphics.poly(mark.points);
  graphics.fill({ color: ENTITY_HOVER_COLOR, alpha: ENTITY_HOVER_ALPHA });
  graphics.poly(mark.points);
  graphics.stroke({ width: ENTITY_HOVER_STROKE_WIDTH * mark.scale, color: ENTITY_HOVER_COLOR, alpha: ENTITY_HOVER_STROKE_ALPHA });
}

/** Peint l'aplat et le liseré de survol : **une** case, aucune autre retouche. */
export function drawEntityHover(graphics: Graphics, marks: readonly EntityHover[]): void {
  marks.forEach((mark) => paintHover(graphics, mark));
}
