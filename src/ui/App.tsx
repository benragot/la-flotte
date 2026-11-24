import { useEffect, useRef } from "react";
import type { ReactNode, ReactElement } from "react";
import "./theme.css";
import type { Position } from "../engine/grid";
import type { BattleState } from "../engine/multiCombat";
import type { ArenaMode, ExplorationView } from "../renderer";
import { CombatCanvas } from "../renderer";
import { turnSide } from "../store/battleSelectors";
import { useCombatStore } from "../store/useCombatStore";
import { useGameStore } from "../store/useGameStore";
import { appScreen, shouldStartExploration } from "./appRouting";
import { CombatHud, BattlePanel, HeroCreation } from "./components";
import { ExplorationJournalPanel, ExplorationStatus } from "./components/ExplorationOverlay";
import { useDemoEntry } from "./demoEntry";
import OverlayPanels from "./components/OverlayPanels";
import { explorationView } from "./explorationView";
import { useEscapeLayer } from "./useEscapeClose";
import { useExplorationPointer } from "./useExplorationPointer";
import { useGlobalShortcuts } from "./useGlobalShortcuts";

/** Écran de création : pontage de bois en fond, feuille centrée (§1.8). */
const CREATION_SHELL =
  "flex h-screen w-screen items-center justify-center overflow-auto bg-[var(--color-surface-0)] [background-image:var(--texture-deck)] p-4";
const ARENA_SHELL = "relative flex h-screen w-screen flex-col overflow-hidden";
/** Surface de la carte : le canvas y remplit tout, le HUD est un frère. */
const ARENA_STAGE_CLASS =
  "flex h-full w-full items-center justify-center bg-[var(--color-surface-0)]";
/** Rangée carte + colonne gauche du journal (exploration) : la carte garde `flex-1`. */
const ARENA_ROW = "relative flex min-h-0 w-full flex-1 overflow-hidden";
/** Combat : bandeau + ligne d'initiative + dock 1.29, soit 240 px de HUD. */
const HUD_HEIGHT_CLASS = "relative h-[240px] w-full shrink-0";
/** Exploration : le dock est le seul contenu, le conteneur épouse donc sa hauteur. */
const EXPLORATION_HUD_CLASS = "relative w-full shrink-0";

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

interface ArenaSectionProps extends ArenaStageProps {
  children?: ReactNode;
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
  useGuardRearm(requested, hasHero);
  const enabled = shouldStartExploration({ hasHero, isFresh, requested: requested.current });
  useEffect(() => {
    if (enabled) runOnce(startExploration, requested);
  }, [enabled, startExploration]);
}

/**
 * « Nouvelle partie » vide le héros : le garde se réarme pour que la création
 * suivante redémarre l'exploration, au lieu de rester bloquée sur l'ancien oui.
 */
function useGuardRearm(requested: OnceGuard, hasHero: boolean): void {
  useEffect(() => {
    if (!hasHero) requested.current = false;
  }, [hasHero, requested]);
}

function runOnce(action: () => void, requested: OnceGuard): void {
  if (requested.current) return;
  requested.current = true;
  action();
}

/** Le héros prête sa classe à la scène : c'est l'`entityId` de sa feuille de sprite. */
function useArenaView(): ArenaView {
  const mode = useCombatStore((state) => state.mode);
  const exploration = useCombatStore((state) => state.exploration);
  const heroClassId = useGameStore((state) => state.hero?.classId ?? null);
  const returnToMap = useCombatStore((state) => state.returnToMap);
  return { mode, view: explorationView({ exploration, heroClassId }), returnToMap };
}

/**
 * Case du héros écrite dans le DOM : sans elle, la position du héros n'est
 * observable par aucun test (le canvas PixiJS n'expose rien au DOM). Une salle
 * ouverte **prime** : le canvas peint ce héros, et la donnée reste immédiate
 * (position du store, aucune animation).
 */
function heroCellLabel(battleHero: Position | undefined, playerPos: Position | undefined): string | undefined {
  const cell = battleHero ?? playerPos;
  return cell === undefined ? undefined : `${cell.x},${cell.y}`;
}

/** Données de scène publiées au DOM : position logique du héros et main en cours. */
function heroPositionOf(battle: BattleState | null): Position | undefined {
  if (battle === null) return undefined;
  return battle.combatants.find((entry) => entry.side === "player")?.position;
}

function arenaData(battle: BattleState | null, exploration: ExplorationView | undefined) {
  const cell = heroCellLabel(heroPositionOf(battle), exploration?.playerPos);
  return { "data-hero-cell": cell, "data-turn-side": turnSide(battle) ?? undefined };
}

function useArenaData(exploration: ExplorationView | undefined) {
  return arenaData(useCombatStore((state) => state.battle), exploration);
}

/** Le canvas remplit la zone libre : `useContainerSize` mesure la surface réellement jouable. */
function ArenaStage({ mode, exploration }: ArenaStageProps) {
  const data = useArenaData(exploration);
  return (
    <main aria-label="Terrain de combat" {...data} className={ARENA_STAGE_CLASS}>
      <CombatCanvas mode={mode} exploration={exploration} />
    </main>
  );
}

/** La zone jouable est `relative` : les overlays d'exploration s'y posent au-dessus du canvas. */
function ArenaSection({ mode, exploration, children }: ArenaSectionProps) {
  const host = useRef<HTMLElement>(null);
  useExplorationPointer(host);
  return (
    <section ref={host} aria-label="Zone jouable" className="relative min-h-0 flex-1">
      <ArenaStage mode={mode} exploration={exploration} />
      {children}
    </section>
  );
}

/** Hauteur du conteneur de HUD par mode : 240 px en combat, épousée en exploration. */
const HUD_CLASS: Record<ArenaMode, string> = {
  combat: HUD_HEIGHT_CLASS,
  exploration: EXPLORATION_HUD_CLASS,
};

/**
 * Le HUD est un frère dans la colonne : sa hauteur suit ses bandes, donc la
 * grille ne passe jamais dessous et aucune bande vide ne mange l'arène.
 */
function Dock({ mode, onReturnToMap }: { mode: ArenaMode; onReturnToMap: () => void }) {
  return (
    <div className={HUD_CLASS[mode]}>
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

/** Couche d'overlays : combat 1vN puis panneaux superposés, hors zone de clic carte. */
function OverlayLayer() {
  return (
    <>
      <BattlePanel />
      <OverlayPanels />
    </>
  );
}

/** Colonne gauche du journal + zone jouable : la carte garde tout l'espace restant. */
function ArenaRow({ exploring, mode, view }: { exploring: boolean; mode: ArenaMode; view: ExplorationView | undefined }) {
  return (
    <div className={ARENA_ROW}>
      {exploring ? <ExplorationJournalPanel /> : null}
      <ArenaSection mode={mode} exploration={view}>{exploring ? <ExplorationStatus /> : null}</ArenaSection>
    </div>
  );
}

/** Arène + dock en colonne, plus la couche d'overlays (sac, fiche perso, combat 1vN). */
function PlayableArena() {
  const { mode, view, returnToMap } = useArenaView();
  return (
    <div className={ARENA_SHELL}>
      <ArenaRow exploring={mode === "exploration"} mode={mode} view={view} />
      <Dock mode={mode} onReturnToMap={returnToMap} />
      <OverlayLayer />
    </div>
  );
}

export default function App(): ReactElement {
  useGameBootstrap();
  useGlobalShortcuts();
  useEscapeLayer();
  useDemoEntry();
  const hero = useGameStore((state) => state.hero);
  useArenaBootstrap(hero !== null);
  if (appScreen(hero !== null) === "creation") return <CreationScreen />;
  return <PlayableArena />;
}
