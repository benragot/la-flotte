import type { BattleState, CombatantLike, Side } from "./types";

/** Retrouve un combattant par identifiant, `undefined` s'il n'existe pas. */
export function findCombatant(state: BattleState, id: string): CombatantLike | undefined {
  return state.combatants.find((combatant) => combatant.id === id);
}

export function isAlive(combatant: CombatantLike): boolean {
  return combatant.hp > 0;
}

export function isAliveById(state: BattleState, id: string): boolean {
  const combatant = findCombatant(state, id);
  return combatant !== undefined && isAlive(combatant);
}

/** Combattants vivants d'un camp, dans l'ordre du tableau d'origine. */
export function livingOf(state: BattleState, side: Side): CombatantLike[] {
  return state.combatants.filter((combatant) => combatant.side === side && isAlive(combatant));
}

export function isActive(state: BattleState, id: string): boolean {
  return state.order[state.activeIndex] === id;
}

/** Ajoute une entrée au journal du combat, sans muter l'état d'entrée. */
export function appendLog(state: BattleState, entry: string): BattleState {
  return { ...state, log: [...state.log, entry] };
}

/** Remplace un combattant par son identifiant, sans muter l'état d'entrée. */
export function withCombatant(state: BattleState, updated: CombatantLike): BattleState {
  const combatants = state.combatants.map((entry) => (entry.id === updated.id ? updated : entry));
  return { ...state, combatants };
}

export function oppositeOf(side: Side): Side {
  return side === "player" ? "enemy" : "player";
}
