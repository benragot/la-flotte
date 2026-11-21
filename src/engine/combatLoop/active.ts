import type { CombatantState, CombatState } from "./types";

/** Entité qui joue pendant la phase en cours (le joueur hors tour ennemi). */
export function getActiveCombatant(state: CombatState): CombatantState {
  return state.phase === "enemy_turn" ? state.enemy : state.player;
}

/** Entité visée par l'entité active. */
export function getOpponent(state: CombatState): CombatantState {
  return state.phase === "enemy_turn" ? state.player : state.enemy;
}

export function setCombatant(state: CombatState, combatant: CombatantState): CombatState {
  if (combatant.kind === "player") return { ...state, player: combatant };
  return { ...state, enemy: combatant };
}

export function isPlayablePhase(state: CombatState): boolean {
  return state.phase === "player_turn" || state.phase === "enemy_turn";
}
