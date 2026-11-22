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

/** Prochain vivant, `null` si la timeline n'en contient aucun. */
function findNextIndex(state: BattleState): number | null {
  const candidates = candidateIndexes(state.order.length, state.activeIndex);
  return candidates.find((index) => livingAt(state, index)) ?? null;
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
 *
 * Sans vivant (`order` vide, tous morts) ou si l'actif est le seul vivant,
 * l'état est renvoyé **inchangé par identité** : un appelant en boucle ne
 * peut plus faire tourner le compteur indéfiniment.
 */
export function advanceTurn(state: BattleState): BattleState {
  const index = findNextIndex(state);
  if (index === null || index === state.activeIndex) return state;
  return restoreActive({
    ...state,
    activeIndex: index,
    turn: state.turn + (index < state.activeIndex ? 1 : 0),
  });
}
