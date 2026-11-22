import { useEffect } from "react";
import type { Application } from "pixi.js";
import type { CombatState } from "../engine/combatLoop/types";
import { useCombatStore } from "../store/useCombatStore";
import { isApplicationAlive } from "./appLifecycle";
import type { GridSize } from "./gridProjection";
import type { BoardLayout, PointerHandlers } from "./pointer";
import { bindPointer, boardLayoutOf } from "./pointer";

export interface CombatPointerInput {
  app: Application | null;
  combat: CombatState | null;
  viewport: GridSize;
}

function boardLayout(combat: CombatState, viewport: GridSize): BoardLayout {
  return boardLayoutOf({ width: combat.map.width, height: combat.map.height }, viewport);
}

/** Relie les événements pointeur PixiJS aux actions du store de combat. */
export function useCombatPointer(input: CombatPointerInput): void {
  const setHoveredCell = useCombatStore((state) => state.setHoveredCell);
  const clickCell = useCombatStore((state) => state.clickCell);
  const { app, combat, viewport } = input;
  useEffect(() => {
    if (combat === null || !isApplicationAlive(app)) return undefined;
    const handlers: PointerHandlers = { setHoveredCell, clickCell };
    return bindPointer(app, boardLayout(combat, viewport), handlers);
  }, [app, combat, viewport, setHoveredCell, clickCell]);
}
