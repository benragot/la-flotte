import type { Graphics } from "pixi.js";
import type { GridOutline, PathHint, TileView } from "./scene";
import { paintShapes } from "./paintShapes";
import { groundColor } from "./tileMaterials";
import type { WallFace } from "./wallFaces";
import { wallFaces, wallTopPoints } from "./wallFaces";
import {
  CELL_OUTLINE,
  CELL_OUTLINE_ALPHA,
  CELL_OUTLINE_WIDTH,
  GRID_LINE,
  GRID_LINE_ALPHA,
  INVALID_CROSS_HALF,
  INVALID_TARGET,
  INVALID_TARGET_ALPHA,
  INVALID_TARGET_WIDTH,
  PATH_ALPHA,
  PATH_DOT_RADIUS,
  PATH_HIGHLIGHT,
  WALL_SIDE,
  WALL_TOP,
} from "./tileStyle";

function paintOutline(graphics: Graphics, points: number[]): void {
  graphics.poly(points);
  graphics.stroke({ width: 1, color: GRID_LINE, alpha: GRID_LINE_ALPHA });
}

function paintStyleStroke(graphics: Graphics, view: TileView): void {
  const { stroke, strokeAlpha } = view.style;
  if (stroke === null) return paintOutline(graphics, view.points);
  graphics.poly(view.points);
  graphics.stroke({ width: 3, color: stroke, alpha: strokeAlpha });
}

/** Sol texturé : teinte du matériau (sable, galets, eau, planches) puis motif. */
function paintGround(graphics: Graphics, view: TileView): void {
  const { x, y } = view.position;
  graphics.poly(view.points);
  graphics.fill({ color: groundColor(view.material, x, y), alpha: view.style.alpha });
  paintStyleStroke(graphics, view);
  paintShapes(graphics, view.texture);
}

/** Aplat translucide des surbrillances : le motif de sol ne doit pas les charger. */
function paintFlat(graphics: Graphics, view: TileView): void {
  graphics.poly(view.points);
  graphics.fill({ color: view.style.fill, alpha: view.style.alpha });
  paintStyleStroke(graphics, view);
}

/** Socle du mur : le losange au sol, plein — c'est lui qui bouche le trou des bords. */
function paintWallFoundation(graphics: Graphics, view: TileView): void {
  graphics.poly(view.points);
  graphics.fill({ color: WALL_SIDE, alpha: 1 });
}

function paintWallFace(graphics: Graphics, face: WallFace): void {
  graphics.poly(face.points);
  graphics.fill({ color: face.color, alpha: 1 });
}

/** Les deux flancs visibles : sans le second, le mur se lit comme une feuille de papier. */
function paintWallSides(graphics: Graphics, view: TileView): void {
  wallFaces(view).forEach((face) => paintWallFace(graphics, face));
}

function paintWallTop(graphics: Graphics, view: TileView): void {
  const top = wallTopPoints(view);
  graphics.poly(top);
  graphics.fill({ color: WALL_TOP, alpha: 1 });
  paintOutline(graphics, top);
  paintShapes(graphics, view.texture);
}

/** Mur : socle plein, deux flancs, puis le dessus — jamais de trou visible. */
function paintWall(graphics: Graphics, view: TileView): void {
  paintWallFoundation(graphics, view);
  paintWallSides(graphics, view);
  paintWallTop(graphics, view);
}

function paintBaseTile(graphics: Graphics, view: TileView): void {
  if (view.cell === "#") return paintWall(graphics, view);
  paintGround(graphics, view);
}

/** Peint chaque vue une seule fois, dans l'ordre du tableau reçu. */
export function paintTiles(graphics: Graphics, views: readonly TileView[]): void {
  views.forEach((view) => paintFlat(graphics, view));
}

/** Peint le sol et ses contours en losanges, matériaux compris. */
export function drawGrid(graphics: Graphics, views: readonly TileView[]): void {
  views.forEach((view) => paintBaseTile(graphics, view));
}

function paintCellOutline(graphics: Graphics, outline: GridOutline): void {
  const width = CELL_OUTLINE_WIDTH * outline.scale;
  graphics.poly(outline.points);
  graphics.stroke({ width, color: CELL_OUTLINE, alpha: CELL_OUTLINE_ALPHA });
}

/** Découpe la carte en cases cliquables : un losange fin par case praticable. */
export function drawOutlines(graphics: Graphics, outlines: readonly GridOutline[]): void {
  outlines.forEach((outline) => paintCellOutline(graphics, outline));
}

/** Peint par-dessus les surbrillances de déplacement et de ciblage. */
export function drawHighlights(graphics: Graphics, views: readonly TileView[]): void {
  paintTiles(graphics, views);
}

/** Pastille du chemin prévisualisé : un point par case, sans contour ni aplat (§3.2, §5). */
function paintPathDot(graphics: Graphics, view: TileView): void {
  graphics.circle(view.center.x, view.center.y, PATH_DOT_RADIUS * view.scale);
  graphics.fill({ color: PATH_HIGHLIGHT, alpha: PATH_ALPHA });
}

/** Chemin survolé : une pastille ronde par case, l'aplat de case resterait illisible. */
export function drawPath(graphics: Graphics, views: readonly TileView[]): void {
  views.forEach((view) => paintPathDot(graphics, view));
}

function isInvalidTarget(hint: PathHint | null | undefined): hint is PathHint {
  return hint !== null && hint !== undefined && !hint.payable;
}

function paintStroke(graphics: Graphics, target: TileView): void {
  const width = INVALID_TARGET_WIDTH * target.scale;
  graphics.stroke({ width, color: INVALID_TARGET, alpha: INVALID_TARGET_ALPHA });
}

/** Croix de la cible invalide (§3.2) : deux branches posées sur le losange visé. */
function paintCross(graphics: Graphics, target: TileView): void {
  const { x, y } = target.center;
  const half = INVALID_CROSS_HALF * target.scale;
  graphics.moveTo(x - half, y - half).lineTo(x + half, y + half);
  graphics.moveTo(x + half, y - half).lineTo(x - half, y + half);
  paintStroke(graphics, target);
}

/** Cible hors budget : contour + croix `#B83B3B` α 0.85, distinct du chemin `#F0B429`. */
export function drawInvalidTarget(graphics: Graphics, hint: PathHint | null | undefined): void {
  if (!isInvalidTarget(hint)) return;
  graphics.poly(hint.target.points);
  paintStroke(graphics, hint.target);
  paintCross(graphics, hint.target);
}
