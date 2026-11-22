import { useEffect } from "react";
import type { Application } from "pixi.js";
import type { Position } from "../engine/grid";
import type { CombatState } from "../engine/combatLoop/types";
import { isApplicationAlive } from "./appLifecycle";
import type { ViewModel } from "./combatSceneModel";
import { buildViewModel } from "./combatSceneModel";
import type { ExplorationView } from "./explorationScene";
import { buildExplorationViewModel } from "./explorationScene";
import type { GridSize } from "./gridProjection";
import { renderScene } from "./sceneLayers";

export type ArenaMode = "combat" | "exploration";

export interface CombatSceneInput {
  app: Application | null;
  combat: CombatState | null;
  selectedSpellId: string | null;
  hoveredCell: Position | null;
  viewport: GridSize;
  mode: ArenaMode;
  exploration?: ExplorationView;
}

function combatModel(input: CombatSceneInput): ViewModel | null {
  if (input.combat === null) return null;
  const { combat, selectedSpellId, hoveredCell, viewport } = input;
  return buildViewModel({ combat, selectedSpellId, hoveredCell, viewport });
}

function explorationModel(input: CombatSceneInput): ViewModel | null {
  if (input.exploration === undefined) return null;
  return buildExplorationViewModel({ exploration: input.exploration, viewport: input.viewport });
}

/** En exploration le combat est ignoré ; sans aucune donnée, rien n'est dessiné. */
function sceneViewModel(input: CombatSceneInput): ViewModel | null {
  const combat = input.mode === "exploration" ? null : combatModel(input);
  return combat ?? explorationModel(input);
}

/** Redessine la scène à chaque changement d'état, jamais sur une application détruite. */
export function useCombatScene(input: CombatSceneInput): void {
  const { app, combat, selectedSpellId, hoveredCell, viewport, mode, exploration } = input;
  const deps: CombatSceneInput = { app, combat, selectedSpellId, hoveredCell, viewport, mode, exploration };
  useEffect(() => {
    const view = sceneViewModel(deps);
    if (view === null || !isApplicationAlive(app)) return;
    renderScene(app, view);
  }, [app, combat, selectedSpellId, hoveredCell, viewport, mode, exploration]);
}
