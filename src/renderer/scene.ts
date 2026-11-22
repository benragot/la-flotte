import type { Graphics } from "pixi.js";
import type { AsciiMap, Position } from "../engine/grid";
import { getCell } from "../engine/grid";
import { allPositions } from "../engine/combatLoop/cells";
import type { TileStyle } from "./tileStyle";
import { GRID_LINE, GRID_LINE_ALPHA, resolveTileStyle } from "./tileStyle";
import type { PixelPoint } from "./gridProjection";
import { TILE_SIZE, gridToScreenOrigin } from "./gridProjection";

export interface TileView {
  origin: PixelPoint;
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

function tileStyleAt(input: SceneInput, position: Position, flags: TileFlags): TileStyle {
  const cell = getCell(input.map, position) ?? ".";
  const isHovered = input.highlight.hover === cellKey(position);
  return resolveTileStyle({ cell, isHovered, ...flags });
}

function tileAt(input: SceneInput, position: Position, flags: TileFlags): TileView {
  return { origin: gridToScreenOrigin(position), style: tileStyleAt(input, position, flags) };
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

/** Modèle d'affichage complet : tuiles de base puis surbrillances. */
export function buildSceneModel(input: SceneInput): SceneModel {
  const positions = allPositions(input.map);
  const base: TileFlags = { isMoveCell: false, isCastCell: false };
  const highlights = positions.map((cell) => highlightTile(input, cell)).filter(isTileView);
  return { tiles: positions.map((cell) => tileAt(input, cell, base)), highlights };
}

function paintOutline(graphics: Graphics, view: TileView): void {
  const { x, y } = view.origin;
  const { stroke, strokeAlpha } = view.style;
  graphics.rect(x, y, TILE_SIZE, TILE_SIZE);
  const color = stroke ?? GRID_LINE;
  const alpha = stroke === null ? GRID_LINE_ALPHA : strokeAlpha;
  graphics.stroke({ width: stroke === null ? 1 : 3, color, alpha });
}

function paintTile(graphics: Graphics, view: TileView): void {
  const { x, y } = view.origin;
  graphics.rect(x, y, TILE_SIZE, TILE_SIZE);
  graphics.fill({ color: view.style.fill, alpha: view.style.alpha });
  paintOutline(graphics, view);
}

function paintTiles(graphics: Graphics, views: readonly TileView[]): void {
  views.forEach((view) => paintTile(graphics, view));
}

/** Peint le sol et ses contours. */
export function drawGrid(graphics: Graphics, views: readonly TileView[]): void {
  paintTiles(graphics, views);
}

/** Peint par-dessus les surbrillances de déplacement et de ciblage. */
export function drawHighlights(graphics: Graphics, views: readonly TileView[]): void {
  paintTiles(graphics, views);
}
