import { useEffect } from "react";
import type { Application } from "pixi.js";
import type { CombatState } from "../engine/combatLoop/types";
import type { Position } from "../engine/grid";
import type { BattleState } from "../engine/multiCombat";
import type { ArenaMode } from "./arenaScene";
import { arenaSceneMap, arenaSceneView } from "./arenaScene";
import { isApplicationAlive } from "./appLifecycle";
import type { ExplorationView } from "./explorationScene";
import type { GridSize } from "./gridProjection";
import { renderScene } from "./sceneLayers";
import type { TrailBatch } from "../store/trails";
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
  /** Trajets reçus du store : aucun chemin n'est recalculé côté rendu. */
  trails?: TrailBatch;
}

/** Redessine la scène à chaque changement d'état, jamais sur une application détruite. */
export function useCombatScene(input: CombatSceneInput): void {
  const { app, combat, battle, selectedSpellId, hoveredCell, viewport, mode, exploration, heroSpriteId, trails } = input;
  useEffect(() => {
    const scene = { combat, battle, selectedSpellId, hoveredCell, viewport, mode, exploration, heroSpriteId, trails };
    const view = arenaSceneView(scene);
    if (view === null || !isApplicationAlive(app)) return;
    renderScene(app, view, { sheets: SPRITE_SHEETS, scene: arenaSceneMap(scene) });
  }, [app, combat, battle, selectedSpellId, hoveredCell, viewport, mode, exploration, heroSpriteId, trails]);
}
