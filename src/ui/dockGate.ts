import type { CombatState } from "../engine/combatLoop/types";
import type { BattleState } from "../engine/multiCombat";

export type DockMode = "combat" | "exploration";

export interface DockGateInput {
  mode: DockMode;
  /** Slice 1v1 de `combatLoop` : le dock historique. */
  combat: CombatState | null;
  /** Slice 1vN du moteur unique : `BattlePanel` la rend, pas le dock. */
  battle: BattleState | null;
}

/**
 * DEC-12 étape 3b : dès qu'un `battle` est publié et que le 1v1 est vide, le
 * dock de sorts remplace le dock historique — **y compris en salle de donjon**,
 * qui reste en mode `exploration` (SPELL-04). Sans `battle`, l'exploration
 * garde son dock du héros.
 */
export type DockSurface = "legacy" | "unified-spells";

export function dockSurface(input: DockGateInput): DockSurface {
  if (input.combat !== null || input.battle === null) return "legacy";
  return "unified-spells";
}

/** Le dock 1v1 est masqué quand le dock de sorts unifié le remplace. */
export function dockHidden(input: DockGateInput): boolean {
  return dockSurface(input) === "unified-spells";
}
