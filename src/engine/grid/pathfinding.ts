import type { AsciiMap, Position } from "./asciiMap";
import { isWalkableCell, samePosition } from "./asciiMap";

/** Coût en PM d'un pas orthogonal (DEC-10). */
export const ORTHOGONAL_STEP_PM = 1;
/** Coût en PM d'un pas diagonal : deux orthogonaux, la diagonale ne gagne rien. */
export const DIAGONAL_STEP_PM = 2;

/** Grille et cases bloquées : la base commune de tout calcul de déplacement. */
interface Board {
  map: AsciiMap;
  occupied?: Position[];
}

export interface PathInput extends Board {
  from: Position;
  to: Position;
  maxPm: number;
}

interface Node {
  pos: Position;
  g: number;
  parent: Position | null;
}

interface SearchState {
  open: Node[];
  closed: Set<string>;
  costs: Map<string, number>;
  parents: Map<string, Position>;
}

interface Visit {
  node: Node;
  position: Position;
}

interface Step {
  node: Node;
  position: Position;
  g: number;
}

function cellKey(position: Position): string {
  return `${position.x},${position.y}`;
}

/**
 * Distance de Chebyshev en cases : géométrie pure, **jamais une facture**
 * (DEC-10 facture `pathCost`). Ne sert plus qu'aux appels sans carte.
 */
export function stepDistance(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Distance de Manhattan : heuristique de A* **admissible et cohérente** avec
 * DEC-10, puisqu'un pas orthogonal réduit `|dx| + |dy|` de 1 pour 1 PM et un
 * pas diagonal de 2 pour 2 PM. Chebyshev, lui, sous-estimerait le reste à payer.
 */
export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Coût en PM du pas `from → to` : 1 orthogonal, 2 diagonal, 0 sur place. */
export function stepCost(from: Position, to: Position): number {
  if (samePosition(from, to)) return 0;
  return from.x === to.x || from.y === to.y ? ORTHOGONAL_STEP_PM : DIAGONAL_STEP_PM;
}

/** Facture d'un chemin : somme du coût de ses pas, jamais une distance à vol d'oiseau. */
export function pathCost(path: readonly Position[]): number {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    if (from !== undefined && to !== undefined) total += stepCost(from, to);
  }
  return total;
}

/** Plus long préfixe contigu payable avec `budget` PM : on s'arrête sur la case payée. */
export function pathWithinBudget(path: readonly Position[], budget: number): Position[] {
  const paid: Position[] = [];
  path.forEach((cell, index) => {
    const prefix = path.slice(0, index + 1);
    if (paid.length === index && pathCost(prefix) <= budget) paid.push(cell);
  });
  return paid;
}

/** Budget suffisant pour tout chemin d'une carte : aucun pas ne coûte plus de 2 PM. */
export function mapPathBudget(map: AsciiMap): number {
  return DIAGONAL_STEP_PM * map.width * map.height;
}

function score(node: Node, target: Position): number {
  return node.g + manhattanDistance(node.pos, target);
}

/** Décalages des huit voisins, dans un ordre figé (déterminisme du chemin). */
const OFFSETS: Position[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

/** Les huit cases voisines d'une case (y compris hors plateau, filtrées par `isFree`). */
export function neighborCells(position: Position): Position[] {
  return OFFSETS.map((offset) => ({ x: position.x + offset.x, y: position.y + offset.y }));
}

function isOccupied(occupied: Position[] | undefined, position: Position): boolean {
  return (occupied ?? []).some((cell) => samePosition(cell, position));
}

function isFree(board: Board, position: Position): boolean {
  if (!isWalkableCell(board.map, position)) return false;
  return !isOccupied(board.occupied, position);
}

/** Les deux cases orthogonales qui bordent un pas diagonal. */
function corners(from: Position, to: Position): Position[] {
  return [
    { x: to.x, y: from.y },
    { x: from.x, y: to.y },
  ];
}

function isDiagonal(from: Position, to: Position): boolean {
  return from.x !== to.x && from.y !== to.y;
}

/**
 * Coin interdit (DEC-10) : un pas diagonal n'est refusé que si ses **deux**
 * cases orthogonales sont bloquées ; un seul blocage reste licite. Une entité
 * occupe sa case comme un mur, donc elle bloque le coin aussi (choix
 * conservateur : on ne frôle pas un combattant en coupant la diagonale).
 */
function cutsCorner(board: Board, from: Position, to: Position): boolean {
  if (!isDiagonal(from, to)) return false;
  return corners(from, to).every((corner) => !isFree(board, corner));
}

/** Pas licite : case d'arrivée libre et coin non coupé. */
function isLegalStep(board: Board, from: Position, to: Position): boolean {
  return isFree(board, to) && !cutsCorner(board, from, to);
}

function stepOf(next: Visit): Step {
  const g = next.node.g + stepCost(next.node.pos, next.position);
  return { node: next.node, position: next.position, g };
}

function createState(input: PathInput): SearchState {
  const start: Node = { pos: input.from, g: 0, parent: null };
  const costs = new Map<string, number>([[cellKey(input.from), 0]]);
  return { open: [start], closed: new Set<string>(), costs, parents: new Map<string, Position>() };
}

function popBest(state: SearchState, target: Position): Node | undefined {
  state.open.sort((a, b) => score(a, target) - score(b, target));
  return state.open.shift();
}

function improves(state: SearchState, position: Position, g: number): boolean {
  const known = state.costs.get(cellKey(position));
  return known === undefined || g < known;
}

function record(state: SearchState, step: Step): void {
  state.costs.set(cellKey(step.position), step.g);
  state.parents.set(cellKey(step.position), step.node.pos);
  state.open.push({ pos: step.position, g: step.g, parent: step.node.pos });
}

function canStep(input: PathInput, state: SearchState, step: Step): boolean {
  if (state.closed.has(cellKey(step.position))) return false;
  if (!isLegalStep(input, step.node.pos, step.position)) return false;
  if (!improves(state, step.position, step.g)) return false;
  return step.g <= input.maxPm;
}

function visit(input: PathInput, state: SearchState, next: Visit): void {
  const step = stepOf(next);
  if (canStep(input, state, step)) record(state, step);
}

function expand(input: PathInput, state: SearchState, node: Node): void {
  state.closed.add(cellKey(node.pos));
  neighborCells(node.pos).forEach((position) => visit(input, state, { node, position }));
}

function runSearch(input: PathInput, state: SearchState): Node | null {
  while (state.open.length > 0) {
    const node = popBest(state, input.to);
    if (node === undefined) return null;
    if (samePosition(node.pos, input.to)) return node;
    expand(input, state, node);
  }
  return null;
}

function rebuildPath(state: SearchState, target: Position): Position[] {
  const path: Position[] = [];
  let current: Position | undefined = target;
  while (current !== undefined) {
    path.push(current);
    current = state.parents.get(cellKey(current));
  }
  return path.reverse();
}

export function findPath(input: PathInput): Position[] | null {
  if (samePosition(input.from, input.to)) return [input.from];
  const state = createState(input);
  const goal = runSearch(input, state);
  return goal === null ? null : rebuildPath(state, goal.pos);
}
