import type { Position } from "../grid";
import { findPath, pathCost } from "../grid";
import { getActiveCombatant, getOpponent, isPlayablePhase, setCombatant } from "./active";
import { appendLog } from "./log";
import type { CombatantState, CombatState } from "./types";

/**
 * La facture est la somme des pas du chemin (DEC-10 : 1 PM orthogonal, 2 PM
 * diagonal). Le journal garde le format historique `N case(s)` parce que le
 * rendu le lit tel quel ; `N` est désormais le coût en PM, pas un nombre de cases.
 */
function applyMove(state: CombatState, mover: CombatantState, path: readonly Position[]): CombatState {
  const cost = pathCost(path);
  const position = path[path.length - 1] ?? mover.position;
  const moved = setCombatant(state, { ...mover, mp: mover.mp - cost, position });
  return appendLog(moved, `${mover.name} se déplace de ${cost} case(s).`);
}

/**
 * Déplace l'entité active le long du plus court chemin en PM ; les PA sont
 * intacts. Renvoie l'état inchangé (même référence) si la phase n'est pas
 * jouable, si la case est bloquée ou si le chemin dépasse les PM restants.
 */
export function moveActiveEntity(state: CombatState, target: Position): CombatState {
  if (!isPlayablePhase(state)) return state;
  const mover = getActiveCombatant(state);
  const opponent = getOpponent(state);
  const options = { map: state.map, from: mover.position, to: target, maxPm: mover.mp };
  const path = findPath({ ...options, occupied: [opponent.position] });
  return path === null ? state : applyMove(state, mover, path);
}
