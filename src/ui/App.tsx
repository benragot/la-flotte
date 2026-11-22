import { useEffect, useRef } from "react";
import type { ReactElement, RefObject } from "react";
import type { ArenaMode, ExplorationView } from "../renderer";
import { CombatCanvas } from "../renderer";
import { useCombatStore } from "../store/useCombatStore";
import { CombatHud } from "./components";
import { explorationView } from "./explorationView";
import { useExplorationPointer } from "./useExplorationPointer";
import { useGlobalShortcuts } from "./useGlobalShortcuts";

/** Hauteur du bloc HUD : 90 px de bandeau + timeline, puis le dock 1.29 de 150 px. */
const HUD_HEIGHT_CLASS = "relative h-[240px] w-full shrink-0";

interface ArenaView {
  mode: ArenaMode;
  view: ExplorationView | undefined;
  returnToMap: () => void;
}

interface ArenaStageProps {
  mode: ArenaMode;
  exploration?: ExplorationView;
}

interface ArenaSectionProps {
  host: RefObject<HTMLDivElement>;
  mode: ArenaMode;
  exploration?: ExplorationView;
}

interface ArenaLayoutProps {
  mode: ArenaMode;
  exploration?: ExplorationView;
  onReturnToMap: () => void;
}

interface HudDockProps {
  mode: ArenaMode;
  onReturnToMap: () => void;
}

/**
 * Démarre l'exploration une seule fois : le garde couvre le double effet de
 * `StrictMode` et un remontage de `App` conserve l'état en cours.
 */
function useArenaBootstrap(): void {
  const startExploration = useCombatStore((state) => state.startExploration);
  const isFresh = useCombatStore((state) => state.combat === null && state.exploration === null);
  const requested = useRef(false);
  useEffect(() => {
    if (requested.current || !isFresh) return;
    requested.current = true;
    startExploration();
  }, [isFresh, startExploration]);
}

function useArenaView(): ArenaView {
  const mode = useCombatStore((state) => state.mode);
  const exploration = useCombatStore((state) => state.exploration);
  const hoveredCell = useCombatStore((state) => state.hoveredCell);
  const returnToMap = useCombatStore((state) => state.returnToMap);
  return { mode, view: explorationView(exploration, hoveredCell), returnToMap };
}

/** Le canvas remplit la zone libre : `useContainerSize` mesure donc la surface réellement jouable. */
function ArenaStage({ mode, exploration }: ArenaStageProps) {
  return (
    <div aria-label="Terrain de combat" className="flex h-full w-full items-center justify-center bg-slate-950">
      <CombatCanvas mode={mode} exploration={exploration} />
    </div>
  );
}

function ArenaSection({ host, mode, exploration }: ArenaSectionProps) {
  return (
    <section ref={host} aria-label="Zone jouable" className="relative min-h-0 flex-1">
      <ArenaStage mode={mode} exploration={exploration} />
    </section>
  );
}

/** Le HUD est un frère dans la colonne : le dock réserve sa place, la grille ne passe jamais dessous. */
function HudDock({ mode, onReturnToMap }: HudDockProps) {
  return (
    <div className={HUD_HEIGHT_CLASS}>
      <CombatHud mode={mode} onReturnToMap={onReturnToMap} />
    </div>
  );
}

function ArenaLayout({ mode, exploration, onReturnToMap }: ArenaLayoutProps) {
  const host = useRef<HTMLDivElement>(null);
  useExplorationPointer(host);
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <ArenaSection host={host} mode={mode} exploration={exploration} />
      <HudDock mode={mode} onReturnToMap={onReturnToMap} />
    </div>
  );
}

export default function App(): ReactElement {
  useArenaBootstrap();
  useGlobalShortcuts();
  const { mode, view, returnToMap } = useArenaView();
  return <ArenaLayout mode={mode} exploration={view} onReturnToMap={returnToMap} />;
}
