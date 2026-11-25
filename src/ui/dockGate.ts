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
 * DEC-12 étape 3 : quand le moteur unique publie un `battle` en mode combat,
 * `BattlePanel` est le **seul** shell — le dock 1v1 disparaît pour ne pas
 * doubler les contrôles. En `legacy`, `battle` reste nul : rien ne change.
 */
export function dockHidden(input: DockGateInput): boolean {
  return input.mode === "combat" && input.combat === null && input.battle !== null;
}
