import { useEffect } from "react";
import type { Application } from "pixi.js";
import type { Position } from "../engine/grid";
import type { CombatState } from "../engine/combatLoop/types";
import { buildViewModel } from "./combatSceneModel";
import { renderScene } from "./sceneLayers";

export interface CombatSceneInput {
  app: Application | null;
  combat: CombatState | null;
  selectedSpellId: string | null;
  hoveredCell: Position | null;
}

/** Redessine la scène à chaque changement d'état de combat, de sort ou de survol. */
export function useCombatScene(input: CombatSceneInput): void {
  const { app, combat, selectedSpellId, hoveredCell } = input;
  useEffect(() => {
    if (app === null || combat === null) return;
    renderScene(app, buildViewModel({ combat, selectedSpellId, hoveredCell }));
  }, [app, combat, selectedSpellId, hoveredCell]);
}
