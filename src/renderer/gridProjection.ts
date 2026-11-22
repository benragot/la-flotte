import type { Position } from "../engine/grid";

/** Largeur du losange d'une case (projection 2:1 de Dofus 1.29). */
export const TILE_W = 64;
/** Hauteur du losange d'une case (projection 2:1 de Dofus 1.29). */
export const TILE_H = 32;

export interface PixelPoint {
  x: number;
  y: number;
}

export interface GridSize {
  width: number;
  height: number;
}

/** Coin haut-gauche du losange de la case (0,0). */
export interface IsoOrigin {
  x: number;
  y: number;
}

export interface IsoCellInput {
  x: number;
  y: number;
  origin: IsoOrigin;
}

export interface IsoPickInput {
  px: number;
  py: number;
  origin: IsoOrigin;
  width: number;
  height: number;
}

export interface CenteredOriginInput {
  width: number;
  height: number;
  viewport: GridSize;
}

export interface Diamond {
  cx: number;
  cy: number;
  points: number[];
}

/** Sommet haut du losange, avant le décalage d'un demi-tour de tuile. */
function isoCorner(input: IsoCellInput): PixelPoint {
  return {
    x: (input.x - input.y) * (TILE_W / 2) + input.origin.x,
    y: (input.x + input.y) * (TILE_H / 2) + input.origin.y,
  };
}

/**
 * Centre pixel du losange d'une case :
 * `sx = (x - y) * TILE_W / 2 + origin.x`, `sy = (x + y) * TILE_H / 2 + origin.y`
 * puis `sy + TILE_H / 2` pour viser le centre et non le sommet haut.
 */
export function gridToIso(input: IsoCellInput): PixelPoint {
  const corner = isoCorner(input);
  return { x: corner.x, y: corner.y + TILE_H / 2 };
}

function isFinitePair(px: number, py: number): boolean {
  return Number.isFinite(px) && Number.isFinite(py);
}

/** Inverse linéaire de la projection, avant arrondi. */
function unskew(input: IsoPickInput): { gx: number; gy: number } {
  const dx = (input.px - input.origin.x) / (TILE_W / 2);
  const dy = (input.py - input.origin.y - TILE_H / 2) / (TILE_H / 2);
  return { gx: (dx + dy) / 2, gy: (dy - dx) / 2 };
}

function isFiniteRaw(raw: { gx: number; gy: number }): boolean {
  return Number.isFinite(raw.gx) && Number.isFinite(raw.gy);
}

/** Évite de propager `-0` dans les positions rendues. */
function normalizeZero(value: number): number {
  return value === 0 ? 0 : value;
}

function toPosition(raw: { gx: number; gy: number }): Position {
  return { x: normalizeZero(Math.round(raw.gx)), y: normalizeZero(Math.round(raw.gy)) };
}

function isInside(position: Position, size: GridSize): boolean {
  const insideX = position.x >= 0 && position.x < size.width;
  const insideY = position.y >= 0 && position.y < size.height;
  return insideX && insideY;
}

/** Case du losange sous un point pixel, `null` hors de la carte ou coordonnée non finie. */
export function isoToGrid(input: IsoPickInput): Position | null {
  if (!isFinitePair(input.px, input.py)) return null;
  const raw = unskew(input);
  if (!isFiniteRaw(raw)) return null;
  const position = toPosition(raw);
  return isInside(position, input) ? position : null;
}

/** Bounding box pixel du losange complet d'une carte `width x height`. */
export function isoMapSize(input: GridSize): GridSize {
  const span = input.width + input.height;
  return { width: (span * TILE_W) / 2, height: (span * TILE_H) / 2 };
}

/** Origine qui centre la carte dans un viewport (négative si le viewport est trop petit). */
export function centeredOrigin(input: CenteredOriginInput): IsoOrigin {
  return {
    x: (input.viewport.width - input.width) / 2,
    y: (input.viewport.height - input.height) / 2,
  };
}

/** Origine de scène d'une carte centrée dans le viewport du conteneur. */
export function sceneOrigin(map: GridSize, viewport: GridSize): IsoOrigin {
  return centeredOrigin({ ...isoMapSize(map), viewport });
}

/** Centre et quatre sommets (haut, droite, bas, gauche) prêts pour `graphics.poly`. */
export function gridDiamond(input: IsoCellInput): Diamond {
  const center = gridToIso(input);
  const halfW = TILE_W / 2;
  const halfH = TILE_H / 2;
  const top = [center.x, center.y - halfH];
  const right = [center.x + halfW, center.y];
  const bottom = [center.x, center.y + halfH];
  const left = [center.x - halfW, center.y];
  return { cx: center.x, cy: center.y, points: [...top, ...right, ...bottom, ...left] };
}
