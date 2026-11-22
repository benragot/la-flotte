import { livingOf, oppositeOf } from "./combatants";
import type { BattleState, CombatantLike, Side } from "./types";

/** Cibles valides pour `side` : les vivants du camp opposé. */
export function targetsOf(state: BattleState, side: Side): CombatantLike[] {
  return livingOf(state, oppositeOf(side));
}

/** Victoire : plus aucun ennemi vivant. */
export function isVictory(state: BattleState): boolean {
  return livingOf(state, "enemy").length === 0;
}

/** Défaite : plus aucun joueur vivant. */
export function isDefeat(state: BattleState): boolean {
  return livingOf(state, "player").length === 0;
}
