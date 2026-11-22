import type { Position } from "../engine/grid";
import type { PixelPoint } from "./gridProjection";
import type { TileView } from "./scene";
import { cellKey } from "./scene";
import type { WalkPlan } from "./sprites/walkMotion";
import { walkPlan } from "./sprites/walkMotion";
import type { TrailBatch } from "../store/trails";
import type { TokenTrail, TokenView } from "./tokens";

/**
 * Trajet **reçu** → trajet **peint**. Ce module ne décide de rien : il projette
 * les cases du moteur en centres écran et refuse tout trajet qui ne se termine
 * pas sur la case du jeton (un lot périmé après un changement de scène).
 *
 * À ne pas confondre avec `ViewModel.path`, qui reste l'**aperçu de survol**
 * peint par `drawPath` : les deux ne partagent ni source ni champ.
 */

/** Centres écran des cases de la scène : de la projection pure, aucun pathfinding. */
export function cellCenters(tiles: readonly TileView[]): ReadonlyMap<string, PixelPoint> {
  return new Map(tiles.map((tile) => [cellKey(tile.position), tile.center]));
}

function sameCell(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

function trailOf(token: TokenView, batch: TrailBatch): TokenTrail | null {
  const trail = batch.trails.find((entry) => entry.id === token.id);
  if (trail === undefined) return null;
  const last = trail.cells.at(-1);
  if (last === undefined || !sameCell(last, token.cell)) return null;
  return { cells: trail.cells, signature: `${token.id}-${batch.version}` };
}

/** Attache à chaque jeton le trajet qui se termine sur sa case, jamais un trajet périmé. */
export function attachTrails(tokens: readonly TokenView[], batch: TrailBatch | null | undefined): TokenView[] {
  if (batch === null || batch === undefined) return [...tokens];
  return tokens.map((token) => ({ ...token, trail: trailOf(token, batch) }));
}

function centreOf(cell: Position, centers: ReadonlyMap<string, PixelPoint>): PixelPoint | undefined {
  return centers.get(cellKey(cell));
}

function isPoint(point: PixelPoint | undefined): point is PixelPoint {
  return point !== undefined;
}

/**
 * Plan de glissement d'un trajet : **une case du moteur = un point**, donc une
 * diagonale reste un seul segment. `null` dès qu'une case n'a pas de centre
 * connu — jamais de chemin raccourci en silence.
 */
export function trailPlan(trail: TokenTrail, centers: ReadonlyMap<string, PixelPoint>): WalkPlan | null {
  const points = trail.cells.map((cell) => centreOf(cell, centers)).filter(isPoint);
  if (points.length !== trail.cells.length) return null;
  return walkPlan(points);
}
