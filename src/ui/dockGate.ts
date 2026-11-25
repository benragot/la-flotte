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
 * DEC-12 étape 3b : un combat d'exploration unifié (`combat` nul, `battle`
 * publié en mode combat) reçoit **le dock de sorts** au lieu de rien. Un donjon
 * reste en mode `exploration` : son dock historique du héros ne bouge pas.
 */
export type DockSurface = "legacy" | "unified-spells";

export function dockSurface(input: DockGateInput): DockSurface {
  if (input.mode !== "combat") return "legacy";
  if (input.combat !== null || input.battle === null) return "legacy";
  return "unified-spells";
}

/** Le dock 1v1 est masqué quand le dock de sorts unifié le remplace. */
export function dockHidden(input: DockGateInput): boolean {
  return dockSurface(input) === "unified-spells";
}
