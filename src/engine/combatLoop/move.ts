import type { Position } from "../grid";
import { findPath } from "../grid";
import { getActiveCombatant, getOpponent, isPlayablePhase, setCombatant } from "./active";
import { appendLog } from "./log";
import type { CombatantState, CombatState } from "./types";

function applyMove(state: CombatState, mover: CombatantState, path: readonly Position[]): CombatState {
  const cost = path.length - 1;
  const position = path[path.length - 1] ?? mover.position;
  const moved = setCombatant(state, { ...mover, mp: mover.mp - cost, position });
  return appendLog(moved, `${mover.name} se déplace de ${cost} case(s).`);
}

/**
 * Déplace l'entité active le long du plus court chemin ; les PM consommés
 * valent `path.length - 1`, les PA sont intacts. Renvoie l'état inchangé
 * (même référence) si la phase n'est pas jouable ou si la case est bloquée.
 */
export function moveActiveEntity(state: CombatState, target: Position): CombatState {
  if (!isPlayablePhase(state)) return state;
  const mover = getActiveCombatant(state);
  const opponent = getOpponent(state);
  const options = { map: state.map, from: mover.position, to: target, maxPm: mover.mp };
  const path = findPath({ ...options, occupied: [opponent.position] });
  return path === null ? state : applyMove(state, mover, path);
}
