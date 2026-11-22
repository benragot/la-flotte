import { isAliveById, withCombatant } from "./combatants";
import { activeCombatant } from "./timeline";
import type { BattleState } from "./types";

/** Indices à examiner après l'actif courant, dans l'ordre circulaire. */
function candidateIndexes(size: number, from: number): number[] {
  return Array.from({ length: size }, (_, step) => (from + step + 1) % size);
}

function livingAt(state: BattleState, index: number): boolean {
  const id = state.order[index];
  return id !== undefined && isAliveById(state, id);
}

/** Prochain vivant ; à défaut l'actif courant est conservé. */
function findNextIndex(state: BattleState): number {
  const size = state.order.length;
  const candidates = candidateIndexes(size, state.activeIndex);
  return candidates.find((index) => livingAt(state, index)) ?? state.activeIndex;
}

/** PA/PM du combattant qui devient actif remis à leurs maxima. */
function restoreActive(state: BattleState): BattleState {
  const active = activeCombatant(state);
  if (active === null) return state;
  return withCombatant(state, { ...active, ap: active.maxAp, mp: active.maxMp });
}

/**
 * Passe au vivant suivant. `turn` n'est incrémenté que si la boucle revient
 * en arrière (donc au premier vivant de l'ordre). Les morts sont sautés et le
 * nouvel actif récupère ses PA/PM. Immuable.
 */
export function advanceTurn(state: BattleState): BattleState {
  const index = findNextIndex(state);
  const wrapped = index <= state.activeIndex;
  const next: BattleState = {
    ...state,
    activeIndex: index,
    turn: state.turn + (wrapped ? 1 : 0),
  };
  return restoreActive(next);
}
