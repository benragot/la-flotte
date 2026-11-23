import { useEffect } from "react";
import type { Application } from "pixi.js";
import type { CombatState } from "../engine/combatLoop/types";
import type { Position } from "../engine/grid";
import type { BattleState } from "../engine/multiCombat";
import { useCombatStore } from "../store/useCombatStore";
import { isApplicationAlive } from "./appLifecycle";
import { battleGridSize } from "./battleSceneModel";
import type { GridSize } from "./gridProjection";
import type { BoardLayout, PointerHandlers } from "./pointer";
import { bindPointer, boardLayoutOf } from "./pointer";

export interface CombatPointerInput {
  app: Application | null;
  combat: CombatState | null;
  /** Salle de donjon ouverte : elle prime sur le 1v1, comme `arenaSceneView`. */
  battle: BattleState | null;
  viewport: GridSize;
}

/** Ce qu'une projection de scène a besoin de connaître, sans l'application Pixi. */
interface SceneLayoutInput {
  combat: CombatState | null;
  battle: BattleState | null;
  viewport: GridSize;
}

type TapCell = (position: Position) => void;

interface TapInput {
  battle: BattleState | null;
  clickCell: TapCell;
  battleMove: (input: { to: Position }) => void;
}

function combatLayout(combat: CombatState, viewport: GridSize): BoardLayout {
  const map = { width: combat.map.width, height: combat.map.height };
  return boardLayoutOf(map, viewport);
}

/**
 * Projection de la scène **réellement peinte** : `arenaSceneView` fait primer la
 * salle sur le 1v1, donc le clic vise la même grille que les jetons affichés.
 * Une salle a la même géométrie que `buildBattleViewModel` (`battleGridSize`).
 */
function sceneLayout(input: SceneLayoutInput): BoardLayout | null {
  if (input.battle !== null) return boardLayoutOf(battleGridSize(input.battle), input.viewport);
  return input.combat === null ? null : combatLayout(input.combat, input.viewport);
}

/**
 * Geste du clic : une salle ouverte déplace le héros actif (`battleMove`), le
 * 1v1 garde `clickCell` (sort ou attaque). Aucun sort n'est lancé par un clic
 * de case : `battleMove` refuse une case occupée **par identité** du store.
 */
function tapFor(input: TapInput): TapCell {
  if (input.battle === null) return input.clickCell;
  return (position: Position) => input.battleMove({ to: position });
}

function usePointerActions() {
  const setHoveredCell = useCombatStore((state) => state.setHoveredCell);
  const clickCell = useCombatStore((state) => state.clickCell);
  const battleMove = useCombatStore((state) => state.battleMove);
  return { setHoveredCell, clickCell, battleMove };
}

/** Relie les événements pointeur PixiJS aux actions du store de combat. */
export function useCombatPointer(input: CombatPointerInput): void {
  const { setHoveredCell, clickCell, battleMove } = usePointerActions();
  const { app, combat, battle, viewport } = input;
  useEffect(() => {
    const layout = sceneLayout({ combat, battle, viewport });
    if (layout === null || !isApplicationAlive(app)) return undefined;
    const handlers: PointerHandlers = { setHoveredCell, clickCell: tapFor({ battle, clickCell, battleMove }) };
    return bindPointer(app, layout, handlers);
  }, [app, combat, battle, viewport, setHoveredCell, clickCell, battleMove]);
}
