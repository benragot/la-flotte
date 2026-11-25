import { useEffect } from "react";
import type { Application } from "pixi.js";
import type { CombatState } from "../engine/combatLoop/types";
import type { Position } from "../engine/grid";
import type { BattleState } from "../engine/multiCombat";
import { useCombatStore } from "../store/useCombatStore";
import { isApplicationAlive } from "./appLifecycle";
import { battleGridSize } from "./battleSceneModel";
import type { GridSize } from "./gridProjection";
import type { BoardLayout, CellPicker, PointerHandlers } from "./pointer";
import { bindPointer, boardLayoutOf } from "./pointer";
import type { TokenAnchor } from "./sprites/tokenHit";
import { hitTargetOf, pickToken } from "./sprites/tokenHit";

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
 * Gestes d'un jeton : une salle ouverte déplace le héros actif (`battleMove`), le
 * 1v1 garde `clickCell` (sort ou attaque). Aucun sort n'est lancé par un clic
 * de case : `battleMove` refuse une case occupée **par identité** du store.
 */
function tapFor(input: TapInput): TapCell {
  if (input.battle === null) return input.clickCell;
  return (position: Position) => input.battleMove({ to: position });
}

/** Combattants réellement peints : la salle prime sur le 1v1, comme la peinture. */
function tokenAnchors(input: SceneLayoutInput): TokenAnchor[] {
  if (input.battle !== null) return input.battle.combatants.map((entry) => ({ id: entry.id, cell: entry.position }));
  const combat = input.combat;
  if (combat === null) return [];
  return [combat.player, combat.enemy].map((entry) => ({ id: entry.id, cell: entry.position }));
}

/**
 * Le picker lit les **mêmes** jetons que la peinture : centre par `gridToIso`,
 * échelle par l'origine, donc la boîte de clic suit le zoom du décor. Le rendu
 * ne décide rien : il rend la **case** du jeton, et le store résout l'identité
 * (attaque, sélection) avec ses propres règles.
 */
function pickerFor(input: SceneLayoutInput, layout: BoardLayout): CellPicker {
  const targets = tokenAnchors(input).map((anchor) => hitTargetOf(anchor, layout.origin));
  return (point) => pickToken(point, targets)?.cell ?? null;
}

/** Actions du store qu'un tap peut déclencher, figées à l'instant du branchement. */
interface PointerActions {
  setHoveredCell: (position: Position | null) => void;
  clickCell: (position: Position) => void;
  battleMove: (input: { to: Position }) => void;
}

/** Entrées d'un branchement pointeur : actions du store, salle ouverte, picker. */
interface PointerSetup {
  actions: PointerActions;
  battle: BattleState | null;
  pickCell: CellPicker;
}

/** Gestes du canvas : le survol, le clic routé par la scène, et le picker de jetons. */
function pointerHandlers(setup: PointerSetup): PointerHandlers {
  const { setHoveredCell, clickCell, battleMove } = setup.actions;
  return { setHoveredCell, clickCell: tapFor({ battle: setup.battle, clickCell, battleMove }), pickCell: setup.pickCell };
}

function usePointerActions(): PointerActions {
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
    const pickCell = pickerFor({ combat, battle, viewport }, layout);
    return bindPointer(app, layout, pointerHandlers({ actions: { setHoveredCell, clickCell, battleMove }, battle, pickCell }));
  }, [app, combat, battle, viewport, setHoveredCell, clickCell, battleMove]);
}
