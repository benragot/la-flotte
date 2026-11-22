import { findCombatant } from "./combatants";
import type { BattleState, CombatantLike } from "./types";

export interface Timeline {
  order: string[];
  activeIndex: number;
}

/** Départage déterministe : à initiative égale, l'id le plus petit passe devant. */
function compareIds(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function byInitiativeDesc(a: CombatantLike, b: CombatantLike): number {
  const diff = b.initiative - a.initiative;
  return diff !== 0 ? diff : compareIds(a.id, b.id);
}

/**
 * Construit la timeline d'un combat 1vN. L'initiative est déjà calculée par
 * l'appelant (`computeInitiative`) : aucun tirage ici.
 */
export function buildTimeline(combatants: readonly CombatantLike[]): Timeline {
  const order = [...combatants].sort(byInitiativeDesc).map((combatant) => combatant.id);
  return { order, activeIndex: 0 };
}

/** Entité qui joue, `null` si la timeline est vide ou incohérente. */
export function activeCombatant(state: BattleState): CombatantLike | null {
  const id = state.order[state.activeIndex];
  if (id === undefined) return null;
  return findCombatant(state, id) ?? null;
}
