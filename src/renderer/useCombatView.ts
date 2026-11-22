import { useCombatStore } from "../store/useCombatStore";
import type { Position } from "../engine/grid";
import type { CombatState } from "../engine/combatLoop/types";

export interface CombatView {
  combat: CombatState | null;
  selectedSpellId: string | null;
  hoveredCell: Position | null;
}

/** Lecture figeable du store de combat, sans le modifier. */
export function useCombatView(): CombatView {
  const combat = useCombatStore((state) => state.combat);
  const selectedSpellId = useCombatStore((state) => state.selectedSpellId);
  const hoveredCell = useCombatStore((state) => state.hoveredCell);
  return { combat, selectedSpellId, hoveredCell };
}
