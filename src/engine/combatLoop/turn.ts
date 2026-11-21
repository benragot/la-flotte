import { runEnemyTurn } from "./enemy";
import { appendLog } from "./log";
import type { CombatState, Rng } from "./types";

function startPlayerTurn(state: CombatState): CombatState {
  const { player } = state;
  const refreshed = { ...player, ap: player.maxAp, mp: player.maxMp };
  const next: CombatState = { ...state, player: refreshed, phase: "player_turn" };
  return appendLog(next, `Tour ${state.turn} : à ${player.name} de jouer.`);
}

/**
 * Clôt le tour du joueur : joue l'IA, incrémente le tour, puis rend la main
 * avec PA/PM restaurés si le joueur est vivant. Les phases `victory` et
 * `defeat` laissent l'état intact (même référence).
 */
export function endPlayerTurn(state: CombatState, rng: Rng): CombatState {
  if (state.phase !== "player_turn") return state;
  const enemyPhase: CombatState = { ...state, phase: "enemy_turn" };
  const resolved = runEnemyTurn(enemyPhase, rng);
  const advanced: CombatState = { ...resolved, turn: state.turn + 1 };
  if (advanced.phase === "defeat") return advanced;
  return startPlayerTurn(advanced);
}
