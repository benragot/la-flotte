import type { Position } from "../../engine/grid";
import type { PixelPoint } from "../gridProjection";
import type { GridOutline, TileView } from "../scene";
import { cellKey } from "../scene";
import type { WalkPlan } from "./walkMotion";
import { walkPlan } from "./walkMotion";

/** Centre pixel de chaque case praticable, indexé par `cellKey`. */
export type WalkField = ReadonlyMap<string, PixelPoint>;

/** Voisins orthogonaux : un pas de case, jamais de diagonale. */
const STEPS: readonly Position[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** Case d'où l'on vient, `null` pour la case de départ. */
type Parents = Map<string, Position | null>;

/**
 * Cases praticables de la scène, avec leur centre peint. Les contours de la
 * grille sont l'autorité : une case absente d'ici n'est **jamais** traversée.
 */
export function walkField(tiles: readonly TileView[], outlines: readonly GridOutline[]): WalkField {
  const walkable = new Set(outlines.map((outline) => cellKey(outline.cell)));
  const entries = tiles.filter((tile) => walkable.has(cellKey(tile.position)));
  return new Map(entries.map((tile) => [cellKey(tile.position), tile.center]));
}

function isWalkable(field: WalkField, cell: Position): boolean {
  return field.has(cellKey(cell));
}

function neighbours(field: WalkField, cell: Position): Position[] {
  const steps = STEPS.map((step) => ({ x: cell.x + step.x, y: cell.y + step.y }));
  return steps.filter((next) => isWalkable(field, next));
}

/** Étend la frontière d'une case : ses voisins praticables pas encore vus. */
function visit(field: WalkField, frontier: Position[], parents: Parents): void {
  const cell = frontier.shift();
  if (cell === undefined) return;
  const fresh = neighbours(field, cell).filter((next) => !parents.has(cellKey(next)));
  fresh.forEach((next) => {
    parents.set(cellKey(next), cell);
    frontier.push(next);
  });
}

/** Remonte la chaîne des parents depuis l'arrivée jusqu'au départ. */
function tracePath(parents: Parents, goal: Position): Position[] {
  const path: Position[] = [];
  let current: Position | null = goal;
  while (current !== null) {
    path.push(current);
    current = parents.get(cellKey(current)) ?? null;
  }
  return path.reverse();
}

/** Parcours en largeur jusqu'à la destination ; rend les parents de toutes les cases vues. */
function search(field: WalkField, from: Position, to: Position): Parents {
  const parents: Parents = new Map([[cellKey(from), null]]);
  const frontier: Position[] = [from];
  while (frontier.length > 0) {
    if (parents.has(cellKey(to))) return parents;
    visit(field, frontier, parents);
  }
  return parents;
}

/**
 * Plus court chemin orthogonal entre deux cases praticables, ou `null` si la
 * destination est inatteignable (mur, case hors carte, autre scène).
 */
export function findWalkPath(field: WalkField, from: Position, to: Position): Position[] | null {
  if (!isWalkable(field, from)) return null;
  if (!isWalkable(field, to)) return null;
  const parents = search(field, from, to);
  return parents.has(cellKey(to)) ? tracePath(parents, to) : null;
}

function isPoint(point: PixelPoint | undefined): point is PixelPoint {
  return point !== undefined;
}

/** Plan de marche d'une suite de cases ; `null` si un centre manque ou s'il n'y a qu'une case. */
export function walkPlanAlong(field: WalkField, cells: readonly Position[]): WalkPlan | null {
  return walkPlan(cells.map((cell) => field.get(cellKey(cell))).filter(isPoint));
}
