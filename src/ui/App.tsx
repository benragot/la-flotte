import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import type { ArenaMode, ExplorationView } from "../renderer";
import { CombatCanvas } from "../renderer";
import { useCombatStore } from "../store/useCombatStore";
import { useGameStore } from "../store/useGameStore";
import { shouldStartExploration } from "./appRouting";
import { CombatHud, HeroCreation } from "./components";
import OverlayPanels from "./components/OverlayPanels";
import { explorationView } from "./explorationView";
import { useExplorationPointer } from "./useExplorationPointer";
import { useGlobalShortcuts } from "./useGlobalShortcuts";

/** Hauteur du bloc HUD : bandeau + timeline, puis le dock 1.29 (dock de 150 px). */
const HUD_HEIGHT_CLASS = "relative h-[240px] w-full shrink-0";

const CREATION_SHELL = "flex h-screen w-screen items-center justify-center overflow-auto bg-slate-950 p-4";
const ARENA_SHELL = "relative flex h-screen w-screen flex-col overflow-hidden";

/** Garde mutable d'un démarrage unique (équivalent structurel de `useRef`). */
interface OnceGuard {
  current: boolean;
}

interface ArenaView {
  mode: ArenaMode;
  view: ExplorationView | undefined;
  returnToMap: () => void;
}

interface ArenaStageProps {
  mode: ArenaMode;
  exploration?: ExplorationView;
}

/**
 * Restaure la sauvegarde au montage, une seule fois : le garde couvre le
 * double effet de `StrictMode` sans écraser une session en cours.
 */
function useGameBootstrap(): void {
  const loadGame = useGameStore((state) => state.loadGame);
  const requested = useRef(false);
  useEffect(() => {
    runOnce(loadGame, requested);
  }, [loadGame]);
}

/**
 * Démarre l'exploration dès qu'un héros existe : création manuelle ou
 * sauvegarde restaurée. Le garde couvre le double effet de `StrictMode`.
 */
function useArenaBootstrap(hasHero: boolean): void {
  const startExploration = useCombatStore((state) => state.startExploration);
  const isFresh = useCombatStore((state) => state.combat === null && state.exploration === null);
  const requested = useRef(false);
  const enabled = shouldStartExploration({ hasHero, isFresh, requested: requested.current });
  useEffect(() => {
    if (enabled) runOnce(startExploration, requested);
  }, [enabled, startExploration]);
}

function runOnce(action: () => void, requested: OnceGuard): void {
  if (requested.current) return;
  requested.current = true;
  action();
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
    <main aria-label="Terrain de combat" className="flex h-full w-full items-center justify-center bg-slate-950">
      <CombatCanvas mode={mode} exploration={exploration} />
    </main>
  );
}

function ArenaSection({ mode, exploration }: ArenaStageProps) {
  const host = useRef<HTMLDivElement>(null);
  useExplorationPointer(host);
  return (
    <section ref={host} aria-label="Zone jouable" className="relative min-h-0 flex-1">
      <ArenaStage mode={mode} exploration={exploration} />
    </section>
  );
}

/** Le HUD est un frère dans la colonne : le dock réserve sa place, la grille ne passe jamais dessous. */
function Dock({ mode, onReturnToMap }: { mode: ArenaMode; onReturnToMap: () => void }) {
  return (
    <div className={HUD_HEIGHT_CLASS}>
      <CombatHud mode={mode} onReturnToMap={onReturnToMap} />
    </div>
  );
}

function CreationScreen() {
  const saveGame = useGameStore((state) => state.saveGame);
  return (
    <main className={CREATION_SHELL}>
      <HeroCreation onCreated={saveGame} />
    </main>
  );
}

/** Arène + dock en colonne, plus les panneaux superposés (sac, fiche perso). */
function PlayableArena() {
  const { mode, view, returnToMap } = useArenaView();
  return (
    <div className={ARENA_SHELL}>
      <ArenaSection mode={mode} exploration={view} />
      <Dock mode={mode} onReturnToMap={returnToMap} />
      <OverlayPanels />
    </div>
  );
}

export default function App(): ReactElement {
  useGameBootstrap();
  useGlobalShortcuts();
  const hero = useGameStore((state) => state.hero);
  useArenaBootstrap(hero !== null);
  if (hero === null) return <CreationScreen />;
  return <PlayableArena />;
}
