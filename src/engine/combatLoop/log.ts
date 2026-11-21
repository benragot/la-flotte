import type { CombatState } from "./types";

export function appendLog(state: CombatState, message: string): CombatState {
  return { ...state, log: [...state.log, message] };
}
