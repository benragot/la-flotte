import type { BattleState } from "../../../engine/multiCombat";
import { isVictory } from "../../../engine/multiCombat";

/** Deux portes de sortie : garder la victoire, ou abandonner la salle. */
export type ClosingAction = "settle" | "end";

/** Salle gagnée = report + sauvegarde ; sinon abandon, **aucun** report de PV. */
export function closingAction(battle: BattleState): ClosingAction {
  return isVictory(battle) ? "settle" : "end";
}

export interface CloseBattleHandlers {
  settle: () => void;
  abandon: () => void;
}

/** Applique `closingAction` : le panneau n'a qu'une seule porte de sortie. */
export function closeBattle(battle: BattleState, handlers: CloseBattleHandlers): void {
  if (closingAction(battle) === "settle") handlers.settle();
  else handlers.abandon();
}
