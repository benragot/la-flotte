import { runEnemyTurn } from "./enemy";
import { appendLog } from "./log";
import type { CombatantState, CombatState, Rng } from "./types";

function restoreApMp(combatant: CombatantState): CombatantState {
  return { ...combatant, ap: combatant.maxAp, mp: combatant.maxMp };
}

function startPlayerTurn(state: CombatState): CombatState {
  const player = restoreApMp(state.player);
  const next: CombatState = { ...state, player, phase: "player_turn" };
  return appendLog(next, `Tour ${state.turn} : à ${player.name} de jouer.`);
}

/** Début du tour ennemi : PA/PM de l'ennemi remis à leurs maxima. */
function startEnemyTurn(state: CombatState): CombatState {
  return { ...state, phase: "enemy_turn", enemy: restoreApMp(state.enemy) };
}

/**
 * Clôt le tour du joueur : restaure les PA/PM de l'ennemi, joue l'IA,
 * incrémente le tour, puis rend la main avec PA/PM du joueur restaurés si
 * celui-ci est vivant. Les phases `victory` et `defeat` laissent l'état
 * intact (même référence).
 */
export function endPlayerTurn(state: CombatState, rng: Rng): CombatState {
  if (state.phase !== "player_turn") return state;
  const resolved = runEnemyTurn(startEnemyTurn(state), rng);
  const advanced: CombatState = { ...resolved, turn: state.turn + 1 };
  if (advanced.phase === "defeat") return advanced;
  return startPlayerTurn(advanced);
}
