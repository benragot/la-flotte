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

/** Palette rétro : pierre/ardoise, sol olive, eau bleu-vert désaturée, ocre. */
export const TILE_COLORS: Record<CellType, number> = {
  ".": 0x4a5c41,
  "#": 0x545a63,
  "~": 0x2f6f6a,
  "P": 0x7d6a35,
  "M": 0x6b3f36,
};

export const MOVE_HIGHLIGHT = 0x3fae6a;
export const CAST_HIGHLIGHT = 0x3f7fd6;
export const HOVER_STROKE = 0xf2d64b;
export const PATH_HIGHLIGHT = 0xf0b429;

export const HIGHLIGHT_ALPHA = 0.5;
export const PATH_ALPHA = 0.32;
export const BASE_ALPHA = 1;
export const GRID_LINE = 0x6b6257;
export const GRID_LINE_ALPHA = 0.55;

/** Grille cliquable : trait clair, fin, visible par défaut sans manger le décor. */
export const CELL_OUTLINE = 0xe8dcc8;
export const CELL_OUTLINE_ALPHA = 0.22;
export const CELL_OUTLINE_WIDTH = 1;

/** Faces du relief des murs : dessus éclairé, flanc dans l'ombre. */
export const WALL_TOP = 0x79828c;
export const WALL_SIDE = 0x3c424a;
export const WALL_HEIGHT = 14;

/** Style d'une étape du chemin A* en exploration. */
export const PATH_STYLE: TileStyle = {
  fill: PATH_HIGHLIGHT,
  alpha: PATH_ALPHA,
  stroke: null,
  strokeAlpha: 0,
};

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
