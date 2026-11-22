import type { CellType } from "../schemas/mapSchema";
import type { AsciiMap, Position } from "../engine/grid";
import { getCell } from "../engine/grid";
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

export interface SceneModel {
  tiles: TileView[];
  highlights: TileView[];
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

/** Modèle d'affichage complet : tuiles de base puis surbrillances, en ordre peintre. */
export function buildSceneModel(input: SceneInput): SceneModel {
  const positions = painterOrder(allPositions(input.map));
  const base: TileFlags = { isMoveCell: false, isCastCell: false };
  const highlights = positions.map((cell) => highlightTile(input, cell)).filter(isTileView);
  return { tiles: positions.map((cell) => tileAt(input, cell, base)), highlights };
}
