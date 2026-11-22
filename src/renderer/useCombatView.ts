import { useCombatStore } from "../store/useCombatStore";
import { useGameStore } from "../store/useGameStore";
import type { Position } from "../engine/grid";
import type { CombatState } from "../engine/combatLoop/types";
import type { BattleState } from "../engine/multiCombat";

export interface CombatView {
  combat: CombatState | null;
  /** Salle de donjon : le canvas la dessine dès qu'elle est ouverte. */
  battle: BattleState | null;
  selectedSpellId: string | null;
  hoveredCell: Position | null;
  /** Classe du héros : l'`entityId` de sa feuille, comme en exploration. */
  heroSpriteId: string | null;
}

/** Lecture figeable du store de combat, sans le modifier. */
export function useCombatView(): CombatView {
  const combat = useCombatStore((state) => state.combat);
  const battle = useCombatStore((state) => state.battle);
  const selectedSpellId = useCombatStore((state) => state.selectedSpellId);
  const hoveredCell = useCombatStore((state) => state.hoveredCell);
  const heroSpriteId = useGameStore((state) => state.hero?.classId ?? null);
  return { combat, battle, selectedSpellId, hoveredCell, heroSpriteId };
}
