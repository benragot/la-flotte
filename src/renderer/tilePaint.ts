import type { Graphics } from "pixi.js";
import type { TileView } from "./scene";
import { TILE_H, TILE_W } from "./gridProjection";
import { GRID_LINE, GRID_LINE_ALPHA, WALL_HEIGHT, WALL_SIDE, WALL_TOP } from "./tileStyle";

/** Sommets du losange translatés verticalement, pour le relief. */
function shiftPoints(points: readonly number[], dy: number): number[] {
  return points.map((value, index) => (index % 2 === 0 ? value : value + dy));
}

function paintOutline(graphics: Graphics, points: number[]): void {
  graphics.poly(points);
  graphics.stroke({ width: 1, color: GRID_LINE, alpha: GRID_LINE_ALPHA });
}

function paintDiamond(graphics: Graphics, view: TileView): void {
  graphics.poly(view.points);
  graphics.fill({ color: view.style.fill, alpha: view.style.alpha });
  const { stroke, strokeAlpha } = view.style;
  if (stroke === null) return paintOutline(graphics, view.points);
  graphics.poly(view.points);
  graphics.stroke({ width: 3, color: stroke, alpha: strokeAlpha });
}

/** Quadrilatère latéral sud-ouest qui donne de l'épaisseur aux murs. */
function wallSide(view: TileView): number[] {
  const { x, y } = view.center;
  const halfW = (TILE_W / 2) * view.scale;
  const halfH = (TILE_H / 2) * view.scale;
  const height = WALL_HEIGHT * view.scale;
  return [x - halfW, y, x, y + halfH, x, y + halfH - height, x - halfW, y - height];
}

function paintWall(graphics: Graphics, view: TileView): void {
  const height = WALL_HEIGHT * view.scale;
  graphics.poly(wallSide(view));
  graphics.fill({ color: WALL_SIDE, alpha: 1 });
  const top = shiftPoints(view.points, -height);
  graphics.poly(top);
  graphics.fill({ color: WALL_TOP, alpha: 1 });
  paintOutline(graphics, top);
}

function paintTile(graphics: Graphics, view: TileView): void {
  if (view.cell === "#") return paintWall(graphics, view);
  paintDiamond(graphics, view);
}

/** Peint chaque vue une seule fois, dans l'ordre du tableau reçu. */
export function paintTiles(graphics: Graphics, views: readonly TileView[]): void {
  views.forEach((view) => paintTile(graphics, view));
}

/** Peint le sol et ses contours en losanges. */
export function drawGrid(graphics: Graphics, views: readonly TileView[]): void {
  paintTiles(graphics, views);
}

/** Peint par-dessus les surbrillances de déplacement et de ciblage. */
export function drawHighlights(graphics: Graphics, views: readonly TileView[]): void {
  paintTiles(graphics, views);
}

/** Peint les losanges translucides du chemin A* en exploration. */
export function drawPath(graphics: Graphics, views: readonly TileView[]): void {
  paintTiles(graphics, views);
}
