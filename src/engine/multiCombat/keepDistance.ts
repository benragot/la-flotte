import type { AsciiMap, Position } from "../grid";
import {
  findPath,
  hasLineOfSight,
  isWalkableCell,
  mapPathBudget,
  pathCost,
  pathWithinBudget,
  rangeDistance,
  samePosition,
} from "../grid";
import type { BattleState, CombatantLike } from "./types";

/**
 * Placement à distance d'un monstre `ai.preferredDistance > 1`.
 *
 * Même convention de déplacement que `approachCell` : chemin `grid/findPath`,
 * 1 PM orthogonal et 2 PM diagonal, cases occupées exclues. La différence est
 * la **case visée** : on cherche une case à la distance de portée du sort, pas
 * une case de contact.
 */
export interface KeepDistanceInput {
  state: BattleState;
  enemy: CombatantLike;
  target: CombatantLike;
  /** Distance de Chebyshev visée, déjà ramenée à la portée du sort. */
  distance: number;
  /** PM restants de l'ennemi. */
  cells: number;
  requiresLos: boolean;
}

interface Landing {
  position: Position;
  /** Écart restant avec la distance visée. */
  error: number;
  cost: number;
}

/** Les autres vivants bloquent le passage et la case d'arrivée. */
function occupiedBy(state: BattleState, enemyId: string): Position[] {
  const living = state.combatants.filter((entry) => entry.id !== enemyId && entry.hp > 0);
  return living.map((entry) => entry.position);
}

function mapCells(map: AsciiMap): Position[] {
  return map.cells.flatMap((row, y) => row.map((_cell, x) => ({ x, y })));
}

function isFree(map: AsciiMap, occupied: readonly Position[], cell: Position): boolean {
  return isWalkableCell(map, cell) && !occupied.some((taken) => samePosition(taken, cell));
}

/** Case réellement atteignable ce tour en visant `cell`, arrêt partiel compris. */
function landingOf(input: KeepDistanceInput, cell: Position, occupied: readonly Position[]): Landing | null {
  const path = pathToCell(input, cell, occupied);
  if (path === null) return null;
  const paid = pathWithinBudget(path, input.cells);
  const landing = paid.at(-1);
  if (paid.length < 2 || landing === undefined) return null;
  const error = Math.abs(rangeDistance(landing, input.target.position) - input.distance);
  return { position: landing, error, cost: pathCost(paid) };
}

function pathToCell(input: KeepDistanceInput, cell: Position, occupied: readonly Position[]): Position[] | null {
  const map = input.state.map;
  if (map === undefined) return null;
  const board = { from: input.enemy.position, to: cell, maxPm: mapPathBudget(map), occupied: [...occupied] };
  return findPath({ map, ...board });
}

function isVisible(input: KeepDistanceInput, cell: Position): boolean {
  const map = input.state.map;
  if (!input.requiresLos || map === undefined) return true;
  return hasLineOfSight({ map, from: cell, to: input.target.position });
}

function candidateAt(input: KeepDistanceInput, cell: Position, occupied: readonly Position[]): Landing | null {
  const landing = landingOf(input, cell, occupied);
  if (landing === null || !isVisible(input, landing.position)) return null;
  return landing;
}

/** Distance d'abord, puis PM dépensés : départage déterministe par le balayage. */
function byCost(best: Landing, next: Landing): Landing {
  return next.cost < best.cost ? next : best;
}

function closerLanding(best: Landing | null, next: Landing): Landing {
  if (best === null) return next;
  if (next.error === best.error) return byCost(best, next);
  return next.error < best.error ? next : best;
}

function bestOf(candidates: readonly (Landing | null)[]): Landing | null {
  const combine = (best: Landing | null, next: Landing | null) => (next === null ? best : closerLanding(best, next));
  return candidates.reduce<Landing | null>(combine, null);
}

function positionOf(landing: Landing | null): Position | null {
  return landing === null ? null : landing.position;
}

/** Case de placement, `null` si aucun pas n'est possible (mur, PM, blocage). */
export function keepDistanceCell(input: KeepDistanceInput): Position | null {
  const map = input.state.map;
  if (map === undefined || input.cells <= 0) return null;
  const occupied = occupiedBy(input.state, input.enemy.id);
  const free = mapCells(map).filter((cell) => isFree(map, occupied, cell));
  return positionOf(bestOf(free.map((cell) => candidateAt(input, cell, occupied))));
}
