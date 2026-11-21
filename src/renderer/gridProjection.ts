import type { Position } from "../engine/grid";

/** Taille d'une tuile en pixels. */
export const TILE_SIZE = 48;

export interface PixelPoint {
  x: number;
  y: number;
}

export interface GridSize {
  width: number;
  height: number;
}

/** Centre en pixels d'une case de la grille. */
export function gridToPixel(position: Position): PixelPoint {
  return {
    x: position.x * TILE_SIZE + TILE_SIZE / 2,
    y: position.y * TILE_SIZE + TILE_SIZE / 2,
  };
}

/** Coin haut-gauche en pixels d'une case de la grille. */
export function gridToScreenOrigin(position: Position): PixelPoint {
  return { x: position.x * TILE_SIZE, y: position.y * TILE_SIZE };
}

function isFinitePoint(point: PixelPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function toTile(value: number): number {
  return Math.floor(value / TILE_SIZE);
}

function isInsideGrid(position: Position, size: GridSize): boolean {
  const insideX = position.x >= 0 && position.x < size.width;
  const insideY = position.y >= 0 && position.y < size.height;
  return insideX && insideY;
}

/** Case de la grille sous un point pixel, `null` hors de la grille. */
export function pixelToGrid(point: PixelPoint, size: GridSize): Position | null {
  if (!isFinitePoint(point)) return null;
  const position = { x: toTile(point.x), y: toTile(point.y) };
  return isInsideGrid(position, size) ? position : null;
}

/** Dimensions pixel du canvas pour une grille donnée. */
export function canvasSize(size: GridSize): { width: number; height: number } {
  return { width: size.width * TILE_SIZE, height: size.height * TILE_SIZE };
}
