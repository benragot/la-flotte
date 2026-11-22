import { useRef } from "react";
import type { ReactElement, RefObject } from "react";
import type { Application } from "pixi.js";
import type { CombatState } from "../engine/combatLoop/types";
import { SCENE_BACKGROUND, combatCanvasSize } from "./combatCanvasConfig";
import type { ExplorationView } from "./explorationScene";
import type { GridSize } from "./gridProjection";
import { useCombatPointer } from "./useCombatPointer";
import { useCombatScene } from "./useCombatScene";
import type { CombatView } from "./useCombatView";
import { useCombatView } from "./useCombatView";
import { useContainerSize } from "./useContainerSize";
import { usePixiApp } from "./usePixiApp";

export type ArenaMode = "combat" | "exploration";

export interface CombatCanvasProps {
  mode?: ArenaMode;
  exploration?: ExplorationView;
}

interface BoardWiringInput {
  app: Application | null;
  view: CombatView;
  size: GridSize;
  props: CombatCanvasProps;
}

/** Le canvas remplit son conteneur : la carte iso est centrée dedans, jamais via `window`. */
const FILL_SIZE = { width: "100%", height: "100%" } as const;

function useBoardSize(
  host: RefObject<HTMLDivElement>,
  combat: CombatState | null,
  exploration?: ExplorationView,
): GridSize {
  const viewport = useContainerSize(host);
  return combatCanvasSize({ combat, viewport, hasExploration: exploration !== undefined });
}

function useBoardWiring(input: BoardWiringInput): void {
  const { app, view, size, props } = input;
  const mode = props.mode ?? "combat";
  const pointerCombat = mode === "exploration" ? null : view.combat;
  useCombatScene({ app, ...view, viewport: size, mode, exploration: props.exploration });
  useCombatPointer({ app, combat: pointerCombat, viewport: size });
}

/** Canvas PixiJS v8 de la grille tactique iso, branché sur le store de combat. */
export function CombatCanvas(props: CombatCanvasProps = {}): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const view = useCombatView();
  const size = useBoardSize(host, view.combat, props.exploration);
  const { app, error } = usePixiApp(host, { background: SCENE_BACKGROUND, size });
  useBoardWiring({ app, view, size, props });
  return <div ref={host} style={FILL_SIZE}>{error === null ? null : <p role="alert">{error}</p>}</div>;
}
