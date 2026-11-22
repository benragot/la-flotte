import type { Position } from "../grid";
import { findPath } from "../grid";
import { getMonsterGroupAt, groupPositions } from "./groups";
import type { ExplorationState, MoveResult } from "./types";

/** Hors combat, le déplacement n'est pas borné par les PM du héros. */
const EXPLORATION_MAX_PM = 99;

function moveLog(steps: number): string {
  return `Le héros se déplace de ${steps} case(s).`;
}

/** Chemin d'aperçu pour l'UI ; `null` si la cible est unreachable ou occupée. */
export function explorationPathTo(state: ExplorationState, target: Position): Position[] | null {
  if (getMonsterGroupAt(state, target) !== null) return null;
  const input = { map: state.map, from: state.playerPos, to: target, maxPm: EXPLORATION_MAX_PM };
  return findPath({ ...input, occupied: groupPositions(state) });
}

function applyPath(state: ExplorationState, path: Position[]): ExplorationState {
  const playerPos = path.at(-1) ?? state.playerPos;
  const log = [...state.log, moveLog(Math.max(path.length - 1, 0))];
  return { ...state, playerPos, log };
}

export function moveHeroOnMap(state: ExplorationState, target: Position): MoveResult {
  const path = explorationPathTo(state, target);
  if (path === null) return { state, path: [] };
  return { state: applyPath(state, path), path };
}
