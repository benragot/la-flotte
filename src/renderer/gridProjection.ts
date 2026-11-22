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

/** Sommet haut du losange de la case (0,0), plus l'échelle de la caméra. */
export interface IsoOrigin {
  x: number;
  y: number;
  /** Facteur « cover » appliqué à toute la projection (1 quand absent). */
  scale?: number;
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
  /** Dimensions de la grille, pas celles de l'image. */
  map: GridSize;
  viewport: GridSize;
  scale?: number;
}

export interface Diamond {
  cx: number;
  cy: number;
  points: number[];
}

/** Échelle portée par l'origine ; 1 pour une projection à taille de référence. */
export function originScale(origin: IsoOrigin): number {
  return origin.scale ?? 1;
}

/** Demi-tuile écran (largeur, hauteur) à l'échelle de l'origine. */
function halfTile(origin: IsoOrigin): PixelPoint {
  const scale = originScale(origin);
  return { x: (TILE_W / 2) * scale, y: (TILE_H / 2) * scale };
}

/** Sommet haut du losange, avant le décalage d'un demi-tour de tuile. */
function isoCorner(input: IsoCellInput): PixelPoint {
  const half = halfTile(input.origin);
  return {
    x: (input.x - input.y) * half.x + input.origin.x,
    y: (input.x + input.y) * half.y + input.origin.y,
  };
}

/**
 * Centre pixel du losange d'une case :
 * `sx = (x - y) * TILE_W / 2 + origin.x`, `sy = (x + y) * TILE_H / 2 + origin.y`
 * puis `sy + TILE_H / 2` pour viser le centre et non le sommet haut.
 * Tout est multiplié par `origin.scale` : la sortie est en pixels écran.
 */
export function gridToIso(input: IsoCellInput): PixelPoint {
  const corner = isoCorner(input);
  return { x: corner.x, y: corner.y + halfTile(input.origin).y };
}

function isFinitePair(px: number, py: number): boolean {
  return Number.isFinite(px) && Number.isFinite(py);
}

/** Inverse linéaire de la projection, avant arrondi. Le point écran est divisé par l'échelle. */
function unskew(input: IsoPickInput): { gx: number; gy: number } {
  const half = halfTile(input.origin);
  const dx = (input.px - input.origin.x) / half.x;
  const dy = (input.py - input.origin.y - half.y) / half.y;
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

/**
 * Boîte d'encre du losange complet d'une carte `width x height` : la demi-tuile
 * de chaque côté est comprise, c'est donc la référence de couverture.
 */
export function isoMapSize(input: GridSize): GridSize {
  const span = input.width + input.height;
  return { width: (span * TILE_W) / 2, height: (span * TILE_H) / 2 };
}

function isPositive(size: GridSize): boolean {
  return size.width > 0 && size.height > 0;
}

/** Échelle « cover » : le losange déborde de l'écran comme une carte Dofus. */
export function coverScale(map: GridSize, viewport: GridSize): number {
  const ink = isoMapSize(map);
  if (!isPositive(ink) || !isPositive(viewport)) return 1;
  return Math.max(viewport.width / ink.width, viewport.height / ink.height);
}

/**
 * Plus grande échelle qui laisse le centre de **chaque** case dans le viewport.
 * C'est elle qui garantit que la case du héros reste cliquable, aux coins compris.
 */
export function cornerSafeScale(map: GridSize, viewport: GridSize): number {
  const span = map.width + map.height - 2;
  if (span <= 0) return Number.POSITIVE_INFINITY;
  return Math.min(viewport.width / ((TILE_W * span) / 2), viewport.height / ((TILE_H * span) / 2));
}

/** Échelle de l'arène : couverture maximale sans jamais perdre une case. */
export function arenaScale(map: GridSize, viewport: GridSize): number {
  return Math.min(coverScale(map, viewport), cornerSafeScale(map, viewport));
}

/**
 * Origine qui centre la boîte d'encre du losange dans le viewport. L'origine est
 * le **sommet haut** de la case (0,0), pas le coin de l'image : d'où le quart de
 * tuile sur chaque axe, et l'asymétrie `width - height` en x.
 */
export function centeredOrigin(input: CenteredOriginInput): IsoOrigin {
  const scale = input.scale ?? 1;
  const { width, height } = input.map;
  return {
    x: input.viewport.width / 2 - scale * (width - height) * (TILE_W / 4),
    y: input.viewport.height / 2 - scale * (width + height) * (TILE_H / 4),
    scale,
  };
}

/** Origine de scène d'une carte centrée et mise à l'échelle dans le viewport du conteneur. */
export function sceneOrigin(map: GridSize, viewport: GridSize): IsoOrigin {
  return centeredOrigin({ map, viewport, scale: arenaScale(map, viewport) });
}

/** Sommets (haut, droite, bas, gauche) autour d'un centre. */
export function diamondPoints(center: PixelPoint, half: PixelPoint): number[] {
  const top = [center.x, center.y - half.y];
  const right = [center.x + half.x, center.y];
  const bottom = [center.x, center.y + half.y];
  const left = [center.x - half.x, center.y];
  return [...top, ...right, ...bottom, ...left];
}

/** Centre et quatre sommets (haut, droite, bas, gauche) prêts pour `graphics.poly`. */
export function gridDiamond(input: IsoCellInput): Diamond {
  const center = gridToIso(input);
  return { cx: center.x, cy: center.y, points: diamondPoints(center, halfTile(input.origin)) };
}

