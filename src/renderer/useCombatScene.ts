import { useEffect } from "react";
import type { Application } from "pixi.js";
import type { CombatState } from "../engine/combatLoop/types";
import type { Position } from "../engine/grid";
import type { BattleState } from "../engine/multiCombat";
import type { ArenaMode } from "./arenaScene";
import { arenaSceneView } from "./arenaScene";
import { isApplicationAlive } from "./appLifecycle";
import type { ExplorationView } from "./explorationScene";
import type { GridSize } from "./gridProjection";
import { renderScene } from "./sceneLayers";
import { SPRITE_SHEETS } from "./spriteManifest";

export interface CombatSceneInput {
  app: Application | null;
  combat: CombatState | null;
  /** Salle de donjon ouverte : elle prime sur le 1v1 et sur l'exploration. */
  battle: BattleState | null;
  selectedSpellId: string | null;
  hoveredCell: Position | null;
  viewport: GridSize;
  mode: ArenaMode;
  exploration?: ExplorationView;
  /** `entityId` de la feuille du héros, prêté par la fiche du personnage. */
  heroSpriteId?: string | null;
}

/** Redessine la scène à chaque changement d'état, jamais sur une application détruite. */
export function useCombatScene(input: CombatSceneInput): void {
  const { app, combat, battle, selectedSpellId, hoveredCell, viewport, mode, exploration, heroSpriteId } = input;
  useEffect(() => {
    const scene = { combat, battle, selectedSpellId, hoveredCell, viewport, mode, exploration, heroSpriteId };
    const view = arenaSceneView(scene);
    if (view === null || !isApplicationAlive(app)) return;
    renderScene(app, view, SPRITE_SHEETS);
  }, [app, combat, battle, selectedSpellId, hoveredCell, viewport, mode, exploration, heroSpriteId]);
}
