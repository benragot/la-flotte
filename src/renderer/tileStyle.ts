import type { CellType } from "../schemas/mapSchema";

export interface TileStyle {
  fill: number;
  alpha: number;
  stroke: number | null;
  strokeAlpha: number;
}

export interface TileStyleInput {
  cell: CellType;
  isMoveCell: boolean;
  isCastCell: boolean;
  isHovered: boolean;
}

export const TILE_COLORS: Record<CellType, number> = {
  ".": 0x4f6b52,
  "#": 0x4a5260,
  "~": 0x2c6c93,
  "P": 0x6a8f6a,
  "M": 0x7a4b4b,
};

export const MOVE_HIGHLIGHT = 0x3fae6a;
export const CAST_HIGHLIGHT = 0x3f7fd6;
export const HOVER_STROKE = 0xf2d64b;

export const HIGHLIGHT_ALPHA = 0.5;
export const BASE_ALPHA = 1;
export const GRID_LINE = 0x101820;
export const GRID_LINE_ALPHA = 0.25;

/** Couleur de base d'une cellule de la carte. */
export function getTileColor(cell: CellType): number {
  return TILE_COLORS[cell];
}

function pickHighlight(input: TileStyleInput): number | null {
  if (input.isCastCell) return CAST_HIGHLIGHT;
  if (input.isMoveCell) return MOVE_HIGHLIGHT;
  return null;
}

function resolveFill(input: TileStyleInput): { fill: number; alpha: number } {
  const highlight = pickHighlight(input);
  if (highlight === null) return { fill: getTileColor(input.cell), alpha: BASE_ALPHA };
  return { fill: highlight, alpha: HIGHLIGHT_ALPHA };
}

function pickStroke(input: TileStyleInput): { stroke: number | null; strokeAlpha: number } {
  if (!input.isHovered) return { stroke: null, strokeAlpha: 0 };
  return { stroke: HOVER_STROKE, strokeAlpha: 1 };
}

/** Style final d'une tuile : survol > ciblage sort > déplacement > couleur de base. */
export function resolveTileStyle(input: TileStyleInput): TileStyle {
  const { fill, alpha } = resolveFill(input);
  const { stroke, strokeAlpha } = pickStroke(input);
  return { fill, alpha, stroke, strokeAlpha };
}
