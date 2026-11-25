import type { CellType } from "../schemas/mapSchema";
import type { Element } from "../schemas/spellSchema";
import { shiftColor } from "./tileMaterials";

export interface TileStyle {
  fill: number;
  alpha: number;
  stroke: number | null;
  strokeAlpha: number;
  /** Trait sombre posé **sous** le liseré : structure la portée sur sable comme sur bois. */
  strokeBacking?: boolean;
  /** Liseré rentré dans la case (fraction 0→1) : le contour plein reste à la zone PM. */
  strokeInset?: number;
  /** Largeur du liseré, en pixels de référence ; 3 px (surbrillance historique) par défaut. */
  strokeWidth?: number;
}

export interface TileStyleInput {
  cell: CellType;
  isMoveCell: boolean;
  isCastCell: boolean;
  isHovered: boolean;
  /** Élément du sort sélectionné : la portée parle sa couleur (§3.1), elle ne la décide pas. */
  castElement?: Element | null;
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
/** Cible invalide (§3.2) : le rouge du refus, contour + croix. */
export const INVALID_TARGET = 0xb83b3b;
export const INVALID_TARGET_ALPHA = 0.85;
export const INVALID_TARGET_WIDTH = 1.5;
/** Branche de la croix « cible invalide », en pixels de référence. */
export const INVALID_CROSS_HALF = 7;
/** Pastille du chemin prévisualisé : cercle r 3 px, sans contour (§3.2, §5). */
export const PATH_DOT_RADIUS = 3;

/** §3.1 : la portée d'un sort porte la couleur de son élément, comme le chat. */
export const CAST_ELEMENT_COLORS: Record<Element, number> = {
  fire: 0xd2452f,
  water: 0x2f7fd2,
  air: 0x3fae6a,
  earth: 0xa9722b,
  neutral: 0xe8dcc8,
};

/**
 * Aplat de portée (§3.2 / §6) : **0,18**, comme la zone PM. Le sol, son motif et
 * les contours de case gardent 82 % de leur lumière — la carte reste lisible.
 */
export const CAST_ZONE_ALPHA = 0.18;
/** Liseré franc : c'est lui qui porte l'identification, pas l'aplat. */
export const CAST_ZONE_STROKE_ALPHA = 0.95;
export const CAST_ZONE_STROKE_WIDTH = 1.2;
/** Losange rentré à 55 % : jamais confondu avec le contour **plein** de la zone PM. */
export const CAST_ZONE_INSET = 0.55;
/**
 * Trait sombre (`surface-0` de `ui-visual-direction.md`) sous le liseré. Mesuré :
 * l'élément seul plafonne à 2,49:1 (Feu) et 1,54:1 (Air) sur le sable ; ce trait
 * tient 8,8:1 sur sable et 3,7:1 sur le ponton. À 0,8 le cœur du Feu tombait à
 * 2,75:1 sur son propre trait : à 0,95 tous les éléments passent 3:1 (Feu 3,5:1).
 */
export const CAST_ZONE_BACKING = 0x14100d;
export const CAST_ZONE_BACKING_ALPHA = 0.95;
export const CAST_ZONE_BACKING_WIDTH = 2.2;

/** Zone PM (§3.2) : aplat **très** discret, le sol doit rester lisible dessous. */
export const MOVE_ZONE_ALPHA = 0.18;
/** Contour de la zone PM (§3.2) : plus franc que l'aplat, sans crier. */
export const MOVE_ZONE_STROKE_ALPHA = 0.35;
export const PATH_ALPHA = 0.32;
export const BASE_ALPHA = 1;
export const GRID_LINE = 0x6b6257;
export const GRID_LINE_ALPHA = 0.55;

/** Grille cliquable : trait clair, fin, visible par défaut sans manger le décor. */
export const CELL_OUTLINE = 0xe8dcc8;
export const CELL_OUTLINE_ALPHA = 0.22;
export const CELL_OUTLINE_WIDTH = 1;

/** Faces du relief des murs : dessus éclairé, flanc ouest dans l'ombre. */
export const WALL_TOP = 0x79828c;
export const WALL_SIDE = 0x3c424a;
/** Flanc est : la même pierre que `WALL_SIDE`, un cran plus claire — la lumière vient du nord-est. */
export const WALL_SIDE_EAST = shiftColor(WALL_SIDE, 18);
/** Hauteur du relief en pixels de référence, avant l'échelle de la caméra. */
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

/** Élément déclaré ⇒ sa teinte ; aucun élément connu ⇒ le bleu historique, jamais inventé. */
export function castColor(element: Element | null | undefined): number {
  return element === null || element === undefined ? CAST_HIGHLIGHT : CAST_ELEMENT_COLORS[element];
}

type StrokeStyle = Pick<TileStyle, "stroke" | "strokeAlpha" | "strokeBacking" | "strokeInset" | "strokeWidth">;

const NO_STROKE: StrokeStyle = { stroke: null, strokeAlpha: 0 };
const HOVER_STYLE: StrokeStyle = { stroke: HOVER_STROKE, strokeAlpha: 1 };
const MOVE_STYLE: StrokeStyle = { stroke: MOVE_HIGHLIGHT, strokeAlpha: MOVE_ZONE_STROKE_ALPHA };

function castStroke(element: Element | null | undefined): StrokeStyle {
  const stroke = castColor(element);
  return { stroke, strokeAlpha: CAST_ZONE_STROKE_ALPHA, strokeBacking: true, strokeInset: CAST_ZONE_INSET, strokeWidth: CAST_ZONE_STROKE_WIDTH };
}

function resolveFill(input: TileStyleInput): { fill: number; alpha: number } {
  if (input.isCastCell) return { fill: castColor(input.castElement), alpha: CAST_ZONE_ALPHA };
  if (input.isMoveCell) return { fill: MOVE_HIGHLIGHT, alpha: MOVE_ZONE_ALPHA };
  return { fill: getTileColor(input.cell), alpha: BASE_ALPHA };
}

function pickStroke(input: TileStyleInput): StrokeStyle {
  if (input.isHovered) return HOVER_STYLE;
  if (input.isCastCell) return castStroke(input.castElement);
  if (input.isMoveCell) return MOVE_STYLE;
  return NO_STROKE;
}

/** Style final d'une tuile : survol > ciblage sort > zone PM (aplat + contour) > couleur de base. */
export function resolveTileStyle(input: TileStyleInput): TileStyle {
  const { fill, alpha } = resolveFill(input);
  return { fill, alpha, ...pickStroke(input) };
}
