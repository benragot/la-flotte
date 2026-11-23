import { useRef } from "react";
import type { ReactElement, RefObject } from "react";
import type { Application } from "pixi.js";
import type { ArenaMode } from "./arenaScene";
import { SCENE_BACKGROUND, combatCanvasSize } from "./combatCanvasConfig";
import type { ExplorationView } from "./explorationScene";
import type { GridSize } from "./gridProjection";
import { useCombatPointer } from "./useCombatPointer";
import { useCombatScene } from "./useCombatScene";
import type { CombatView } from "./useCombatView";
import { useCombatView } from "./useCombatView";
import { useContainerSize } from "./useContainerSize";
import { usePixiApp } from "./usePixiApp";
import { useSceneHover } from "./useSceneHover";

export type { ArenaMode };

export interface CombatCanvasProps {
  mode?: ArenaMode;
  exploration?: ExplorationView;
}

interface BoardWiringInput {
  app: Application | null;
  view: CombatView;
  size: GridSize;
  props: CombatCanvasProps;
  /** L'élément qui monte le canvas : frontière des écouteurs pointeur DOM. */
  host: RefObject<HTMLDivElement>;
}

/** Le canvas remplit son conteneur : la carte iso est centrée dedans, jamais via `window`. */
const FILL_SIZE = { width: "100%", height: "100%" } as const;

function useBoardSize(
  host: RefObject<HTMLDivElement>,
  view: CombatView,
  exploration?: ExplorationView,
): GridSize {
  const viewport = useContainerSize(host);
  const hasExploration = exploration !== undefined;
  return combatCanvasSize({ combat: view.combat, viewport, hasExploration, hasBattle: view.battle !== null });
}

/**
 * Grille du survol DOM : seulement quand **la peinture** est l'exploration. En
 * 1v1, le pointeur PixiJS écrit déjà `hoveredCell` ; dans une salle, la scène
 * peinte n'est pas la carte d'exploration — on n'écoute donc rien.
 */
function exploringMap(props: CombatCanvasProps): GridSize | null {
  return props.exploration?.map ?? null;
}

function isExploring(props: CombatCanvasProps): boolean {
  return (props.mode ?? "combat") === "exploration";
}

function hoverMap(view: CombatView, props: CombatCanvasProps): GridSize | null {
  if (!isExploring(props)) return null;
  if (view.battle !== null) return null;
  return exploringMap(props);
}

function useBoardWiring(input: BoardWiringInput): void {
  const { app, view, size, props, host } = input;
  const mode = props.mode ?? "combat";
  const pointerCombat = mode === "exploration" ? null : view.combat;
  useCombatScene({ app, ...view, viewport: size, mode, exploration: props.exploration });
  // La salle prime sur le 1v1, exactement comme la peinture (`arenaSceneView`).
  useCombatPointer({ app, combat: pointerCombat, battle: view.battle, viewport: size });
  useSceneHover({ host, map: hoverMap(view, props), viewport: size });
}

/** Canvas PixiJS v8 de la grille tactique iso, branché sur le store de combat. */
export function CombatCanvas(props: CombatCanvasProps = {}): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const view = useCombatView();
  const size = useBoardSize(host, view, props.exploration);
  const { app, error } = usePixiApp(host, { background: SCENE_BACKGROUND, size });
  useBoardWiring({ app, view, size, props, host });
  return <div ref={host} style={FILL_SIZE}>{error === null ? null : <p role="alert">{error}</p>}</div>;
}
