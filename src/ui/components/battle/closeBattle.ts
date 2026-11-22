import type { BattleState } from "../../../engine/multiCombat";
import { isDefeat, isVictory } from "../../../engine/multiCombat";

/** Deux portes de sortie : garder la victoire, ou abandonner la salle. */
export type ClosingAction = "settle" | "end";

/**
 * Salle gagnée = report + sauvegarde ; sinon abandon, **aucun** report de PV.
 * La mort du héros prime sur la victoire : `isDefeat` et `isVictory` ne sont pas
 * exclusifs (annihilation mutuelle), et persister un héros à 0 PV casse la partie.
 */
export function closingAction(battle: BattleState): ClosingAction {
  if (isDefeat(battle)) return "end";
  if (isVictory(battle)) return "settle";
  return "end";
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
