import type { PathInput } from "../grid";
import { findPath, manhattanDistance, samePosition } from "../grid";
import type { AsciiMap, Position } from "../grid";
import { getActiveCombatant, getOpponent } from "./active";
import type { CombatState } from "./types";

/** Distance de Manhattan, définie une seule fois dans `grid` (heuristique A*). */
export const manhattan = manhattanDistance;

export function allPositions(map: AsciiMap): Position[] {
  const cells: Position[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) cells.push({ x, y });
  }
  return cells;
}

function isReachableCell(options: Omit<PathInput, "to">, cell: Position): boolean {
  if (samePosition(cell, options.from)) return false;
  return findPath({ ...options, to: cell }) !== null;
}

/** Cases atteignables par l'entité active avec ses PM restants (coût DEC-10). */
export function getReachableCells(state: CombatState): Position[] {
  const mover = getActiveCombatant(state);
  const opponent = getOpponent(state);
  const options = { map: state.map, from: mover.position, maxPm: mover.mp, occupied: [opponent.position] };
  return allPositions(state.map).filter((cell) => isReachableCell(options, cell));
}
