import { useCallback, useEffect, useMemo, useRef } from "react";
import { nextBeatAt } from "../../../engine/combat/beat";
import type { BattleState } from "../../../engine/multiCombat";
import { MAX_ENEMY_STEPS, needsEnemyStep, openingBeatNeeded } from "../../../store/battleSelectors";
import { useCombatStore } from "../../../store/useCombatStore";

type BeatTimer = ReturnType<typeof setTimeout>;

/** Réfs stables du pilote : le minuteur et le drapeau de vie. */
interface BeatRefs {
  timer: { current: BeatTimer | null };
  alive: { current: boolean };
}

export interface BeatPlanInput {
  lastActionAt: number;
  now: number;
  /** Un pas est-il encore dû ? Calculé par l'appelant, jamais par une horloge ici. */
  needed: boolean;
}

export interface CombatBeatHandlers {
  /** Sort du héros : refusé tant que le beat de l'action précédente n'est pas écoulé. */
  attack: (targetId: string) => void;
  /** « Terminer le tour » : passe la main, puis cadence un pas ennemi par beat. */
  endTurn: () => void;
}

export interface BeatActionInput {
  now: number;
  /** Gardien de cadence du store, consulté avec `now`. */
  canAct: (now: number) => boolean;
  /** L'action elle-même : `true` **seulement** si elle a réellement eu lieu. */
  perform: () => boolean;
  /** Pose la borne basse ; jamais appelée sur un refus. */
  stamp: (now: number) => void;
}

/**
 * Un clic refusé (PA insuffisants, hors portée, cible invalide) n'est pas une
 * action : il ne pose **aucun** tampon, donc le joueur peut recliquer aussitôt.
 */
export function runBeatAction(input: BeatActionInput): boolean {
  if (!input.canAct(input.now)) return false;
  if (!input.perform()) return false;
  input.stamp(input.now);
  return true;
}

/** Délai avant le prochain pas : 0 si le beat est écoulé, `null` si rien n'est dû. */
export function nextBeatDelay(input: BeatPlanInput): number | null {
  if (!input.needed) return null;
  return Math.max(0, nextBeatAt(input.lastActionAt) - input.now);
}

function clearBeatTimer(timer: { current: BeatTimer | null }): void {
  if (timer.current !== null) clearTimeout(timer.current);
  timer.current = null;
}

/** Un pas, horodaté : la borne basse de l'action suivante repart de maintenant. */
function stepNow(refs: BeatRefs, steps: number): void {
  if (!refs.alive.current) return;
  const store = useCombatStore.getState();
  store.playEnemyStepOnce();
  store.stampActionAt(Date.now());
  scheduleStep(refs, steps + 1);
}

/** Planifie le pas suivant ; un seul minuteur vivant, la borne dure ferme la boucle. */
function scheduleStep(refs: BeatRefs, steps: number): void {
  clearBeatTimer(refs.timer);
  if (!refs.alive.current || steps >= MAX_ENEMY_STEPS) return;
  const store = useCombatStore.getState();
  const options = { lastActionAt: store.lastActionAt, now: Date.now(), needed: needsEnemyStep(store.battle, steps > 0) };
  const delay = nextBeatDelay(options);
  if (delay !== null) refs.timer.current = setTimeout(() => stepNow(refs, steps), delay);
}

/** Nettoyage au démontage : `clearTimeout` puis plus aucune écriture de store. */
function useBeatLifecycle(refs: BeatRefs): void {
  const { timer, alive } = refs;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearBeatTimer(timer);
    };
  }, [alive, timer]);
}

/** Action du héros : refusée tant que le beat de la précédente n'est pas écoulé. */
function useBeatAttack(): (targetId: string) => void {
  return useCallback((targetId: string) => {
    const store = useCombatStore.getState();
    const input = { now: Date.now(), canAct: store.canActNow, stamp: store.stampActionAt };
    runBeatAction({ ...input, perform: () => store.battleSpellAttack({ targetId }) });
  }, []);
}

/** « Terminer le tour » : horodate l'action du joueur, puis lance la cadence. */
function useBeatStart(refs: BeatRefs): () => void {
  const { timer } = refs;
  return useCallback(() => {
    clearBeatTimer(timer);
    useCombatStore.getState().stampActionAt(Date.now());
    scheduleStep(refs, 0);
  }, [refs, timer]);
}

/**
 * Réclamation de l'ouverture : un pas d'ouverture au plus par main ennemie,
 * libérable au cleanup pour qu'un second montage puisse réclamer à nouveau.
 */
export interface OpeningClaim {
  /** `true` si l'ouverture est due **et** libre ; la main du héros la libère. */
  tryClaim: (battle: BattleState | null) => boolean;
  /** Rend la réclamation : le prochain setup (StrictMode) repart libre. */
  release: () => void;
}

interface ClaimState {
  held: boolean;
}

function releaseClaim(state: ClaimState): false {
  state.held = false;
  return false;
}

function holdClaim(state: ClaimState): boolean {
  if (state.held) return false;
  state.held = true;
  return true;
}

/** Une seule ouverture planifiée tant que la main reste ennemie, jamais deux. */
export function createOpeningClaim(): OpeningClaim {
  const state: ClaimState = { held: false };
  const tryClaim = (battle: BattleState | null): boolean =>
    openingBeatNeeded(battle) ? holdClaim(state) : releaseClaim(state);
  const release = (): void => {
    state.held = false;
  };
  return { tryClaim, release };
}

/** Le setup réclame puis planifie ; le cleanup libère **et** coupe le minuteur. */
function useOpeningEffect(refs: BeatRefs, claim: OpeningClaim, opening: boolean): void {
  useEffect(() => {
    if (!opening) return;
    if (claim.tryClaim(useCombatStore.getState().battle)) scheduleStep(refs, 0);
    return () => {
      claim.release();
      clearBeatTimer(refs.timer);
    };
  }, [refs, claim, opening]);
}

/** Panneau monté sur une main ennemie : le premier pas part sans clic. */
function useOpeningBeat(refs: BeatRefs, claim: OpeningClaim): void {
  const opening = useCombatStore((state) => openingBeatNeeded(state.battle));
  useOpeningEffect(refs, claim, opening);
}

/** Réclamation stable : elle survit aux rendus, pas aux cleanups (qui la libèrent). */
function useBeatClaim(): OpeningClaim {
  return useMemo(() => createOpeningClaim(), []);
}

/** Réfs stables du pilote : un minuteur qui survit aux rendus, rien de plus. */
function useBeatRefs(): BeatRefs {
  const timer = useRef<BeatTimer | null>(null);
  const alive = useRef(true);
  return useMemo(() => ({ timer, alive }), [timer, alive]);
}

/**
 * Pilote la cadence de combat : un beat de lecture entre deux actions, aucune
 * animation. Le minuteur vit ici, pas dans le JSX : `clearTimeout` au démontage
 * et drapeau `alive`, donc **aucune** écriture de store après démontage.
 */
export function useCombatBeat(): CombatBeatHandlers {
  const refs = useBeatRefs();
  const claim = useBeatClaim();
  useBeatLifecycle(refs);
  useOpeningBeat(refs, claim);
  return { attack: useBeatAttack(), endTurn: useBeatStart(refs) };
}
