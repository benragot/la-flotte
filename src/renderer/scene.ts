import type { CellType } from "../schemas/mapSchema";
import type { AsciiMap, Position } from "../engine/grid";
import { getCell, isWalkableCell } from "../engine/grid";
import { allPositions } from "../engine/combatLoop/cells";
import type { IsoOrigin, PixelPoint } from "./gridProjection";
import { gridDiamond, originScale } from "./gridProjection";
import type { TileStyle } from "./tileStyle";
import { resolveTileStyle } from "./tileStyle";

export interface TileView {
  cell: CellType;
  center: PixelPoint;
  points: number[];
  /** Échelle de la caméra, pour que le relief des murs suive le décor. */
  scale: number;
  style: TileStyle;
}

export interface GridHighlight {
  move: ReadonlySet<string>;
  cast: ReadonlySet<string>;
  hover: string | null;
}

export interface SceneInput {
  map: AsciiMap;
  highlight: GridHighlight;
  origin: IsoOrigin;
}

/**
 * Contour fin d'une case praticable. Il découpe la carte en losanges cliquables
 * et reste **sous** les jetons : c'est la grille de Dofus, pas un décor.
 */
export interface GridOutline {
  cell: Position;
  points: number[];
  scale: number;
}

export interface SceneModel {
  tiles: TileView[];
  highlights: TileView[];
  /** Un contour par case praticable : aucun mur, aucune case hors carte. */
  outlines: GridOutline[];
}

interface TileFlags {
  isMoveCell: boolean;
  isCastCell: boolean;
}

/** Clé stable d'une case, utilisée pour les ensembles de surbrillance. */
export function cellKey(position: Position): string {
  return `${position.x}:${position.y}`;
}

/** Profondeur isométrique d'une case : c'est elle qui ordonne le rendu peintre. */
export function depthOf(position: Position): number {
  return position.x + position.y;
}

function depthOrder(a: Position, b: Position): number {
  const delta = depthOf(a) - depthOf(b);
  return delta === 0 ? a.y - b.y : delta;
}

/** Ordre peintre : cases du haut de l'écran d'abord (`x + y` croissant). */
export function painterOrder(positions: readonly Position[]): Position[] {
  return [...positions].sort(depthOrder);
}

function tileAt(input: SceneInput, position: Position, flags: TileFlags): TileView {
  const cell = getCell(input.map, position) ?? ".";
  const diamond = gridDiamond({ ...position, origin: input.origin });
  const isHovered = input.highlight.hover === cellKey(position);
  const center = { x: diamond.cx, y: diamond.cy };
  const style = resolveTileStyle({ cell, isHovered, ...flags });
  return { cell, center, points: diamond.points, scale: originScale(input.origin), style };
}

function highlightTile(input: SceneInput, position: Position): TileView | null {
  const key = cellKey(position);
  const flags = { isMoveCell: input.highlight.move.has(key), isCastCell: input.highlight.cast.has(key) };
  if (!flags.isMoveCell && !flags.isCastCell) return null;
  return tileAt(input, position, flags);
}

function isTileView(view: TileView | null): view is TileView {
  return view !== null;
}

function outlineAt(origin: IsoOrigin, cell: Position): GridOutline {
  return { cell, points: gridDiamond({ ...cell, origin }).points, scale: originScale(origin) };
}

/** Contours des seules cases praticables, en ordre peintre comme les tuiles. */
export function gridOutlines(map: AsciiMap, origin: IsoOrigin): GridOutline[] {
  const walkable = allPositions(map).filter((cell) => isWalkableCell(map, cell));
  return painterOrder(walkable).map((cell) => outlineAt(origin, cell));
}

/** Modèle d'affichage complet : tuiles de base puis surbrillances, en ordre peintre. */
export function buildSceneModel(input: SceneInput): SceneModel {
  const positions = painterOrder(allPositions(input.map));
  const base: TileFlags = { isMoveCell: false, isCastCell: false };
  const highlights = positions.map((cell) => highlightTile(input, cell)).filter(isTileView);
  const tiles = positions.map((cell) => tileAt(input, cell, base));
  return { tiles, highlights, outlines: gridOutlines(input.map, input.origin) };
}
