import { computeInitiative } from "../combat/initiative";
import { appendLog } from "./log";
import { openWithEnemy } from "./turn";
import type { CombatantState, CombatState, Rng } from "./types";

export type OpeningPhase = "player_turn" | "enemy_turn";

/** Initiative 1.29 d'un combattant : stats pondérées par les PV restants. */
export function initiativeOf(combatant: CombatantState): number {
  const { strength, intelligence, chance, agility } = combatant.stats;
  const maxHp = Math.max(combatant.maxHp, 1);
  return computeInitiative({ strength, intelligence, chance, agility, currentHp: combatant.hp, maxHp });
}

/** Égalité ⇒ héros : l'ouverture reste déterministe. */
export function openingPhase(state: CombatState): OpeningPhase {
  return initiativeOf(state.enemy) > initiativeOf(state.player) ? "enemy_turn" : "player_turn";
}

function openingNote(state: CombatState): string {
  const enemy = initiativeOf(state.enemy);
  const player = initiativeOf(state.player);
  return `${state.enemy.name} joue en premier (initiative ${enemy} vs ${player}).`;
}

/** Ouvre le combat : le monstre plus rapide agit, puis le héros reçoit la main. */
export function beginCombat(state: CombatState, rng: Rng): CombatState {
  if (openingPhase(state) === "player_turn") return state;
  return openWithEnemy(appendLog(state, openingNote(state)), rng);
}
