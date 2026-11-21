import { useEffect } from "react";
import type { Application } from "pixi.js";
import type { CombatState } from "../engine/combatLoop/types";
import { useCombatStore } from "../store/useCombatStore";
import { isApplicationAlive } from "./appLifecycle";
import type { PointerHandlers } from "./pointer";
import { bindPointer } from "./pointer";

export interface CombatPointerInput {
  app: Application | null;
  combat: CombatState | null;
}

function bindCombat(app: Application, combat: CombatState, handlers: PointerHandlers): () => void {
  return bindPointer(app, { width: combat.map.width, height: combat.map.height }, handlers);
}

/** Relie les événements pointeur PixiJS aux actions du store de combat. */
export function useCombatPointer(input: CombatPointerInput): void {
  const setHoveredCell = useCombatStore((state) => state.setHoveredCell);
  const clickCell = useCombatStore((state) => state.clickCell);
  const { app, combat } = input;
  useEffect(() => {
    if (combat === null || !isApplicationAlive(app)) return undefined;
    return bindCombat(app, combat, { setHoveredCell, clickCell });
  }, [app, combat, setHoveredCell, clickCell]);
}
