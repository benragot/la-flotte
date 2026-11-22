import type { AsciiMap, Position } from "./asciiMap";
import { isWalkableCell, samePosition } from "./asciiMap";

export interface PathInput {
  map: AsciiMap;
  from: Position;
  to: Position;
  maxPm: number;
  occupied?: Position[];
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
 * Distance en pas sur une grille à huit directions : la diagonale coûte 1,
 * donc `max(|dx|, |dy|)` (Chebyshev) et jamais `manhattan`. C'est la mesure
 * de référence pour facturer un déplacement, pas seulement pour l'heuristique.
 */
export function stepDistance(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function score(node: Node, target: Position): number {
  return node.g + stepDistance(node.pos, target);
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

/** Diagonale = 1 PM, comme l'orthogonal ; le coin bloqué ne la ferme jamais. */
function neighbors(position: Position): Position[] {
  return OFFSETS.map((offset) => ({ x: position.x + offset.x, y: position.y + offset.y }));
}

function isOccupied(occupied: Position[] | undefined, position: Position): boolean {
  return (occupied ?? []).some((cell) => samePosition(cell, position));
}

function isFree(input: PathInput, position: Position): boolean {
  if (!isWalkableCell(input.map, position)) return false;
  return !isOccupied(input.occupied, position);
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

function isReachable(input: PathInput, state: SearchState, position: Position): boolean {
  return !state.closed.has(cellKey(position)) && isFree(input, position);
}

function canStep(input: PathInput, state: SearchState, next: Visit): boolean {
  const g = next.node.g + 1;
  if (!isReachable(input, state, next.position)) return false;
  if (!improves(state, next.position, g)) return false;
  return g <= input.maxPm;
}

function visit(input: PathInput, state: SearchState, next: Visit): void {
  if (!canStep(input, state, next)) return;
  record(state, { node: next.node, position: next.position, g: next.node.g + 1 });
}

function expand(input: PathInput, state: SearchState, node: Node): void {
  state.closed.add(cellKey(node.pos));
  neighbors(node.pos).forEach((position) => visit(input, state, { node, position }));
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
