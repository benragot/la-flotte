import { useCallback, useEffect, useMemo, useRef } from "react";
import { nextBeatAt } from "../../../engine/combat/beat";
import type { BattleState } from "../../../engine/multiCombat";
import { MAX_ENEMY_STEPS, needsEnemyStep, openingBeatNeeded } from "../../../store/battleSelectors";
import { useCombatStore } from "../../../store/useCombatStore";

type BeatTimer = ReturnType<typeof setTimeout>;

/** Réfs stables du pilote : le minuteur, le drapeau de vie et l'ouverture déjà jouée. */
interface BeatRefs {
  timer: { current: BeatTimer | null };
  alive: { current: boolean };
  opened: { current: boolean };
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

/** Planifie le pas suivant ; la borne dure `MAX_ENEMY_STEPS` ferme toute boucle. */
function scheduleStep(refs: BeatRefs, steps: number): void {
  refs.timer.current = null;
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
 * L'ouverture ne part qu'**une fois** par main ennemie : le drapeau retombe dès
 * que le héros reprend la main, donc aucune double planification ni relance
 * après la borne `MAX_ENEMY_STEPS`.
 */
function claimOpening(refs: BeatRefs, battle: BattleState | null): boolean {
  if (!openingBeatNeeded(battle)) {
    refs.opened.current = false;
    return false;
  }
  if (refs.opened.current || refs.timer.current !== null) return false;
  refs.opened.current = true;
  return true;
}

/** Panneau monté sur une main ennemie : le premier pas part sans clic. */
function useOpeningBeat(refs: BeatRefs): void {
  const battle = useCombatStore((state) => state.battle);
  useEffect(() => {
    if (claimOpening(refs, battle)) scheduleStep(refs, 0);
  }, [refs, battle]);
}

/** Réfs stables du pilote : un minuteur qui survit aux rendus, rien de plus. */
function useBeatRefs(): BeatRefs {
  const timer = useRef<BeatTimer | null>(null);
  const alive = useRef(true);
  const opened = useRef(false);
  return useMemo(() => ({ timer, alive, opened }), [timer, alive, opened]);
}

/**
 * Pilote la cadence de combat : un beat de lecture entre deux actions, aucune
 * animation. Le minuteur vit ici, pas dans le JSX : `clearTimeout` au démontage
 * et drapeau `alive`, donc **aucune** écriture de store après démontage.
 */
export function useCombatBeat(): CombatBeatHandlers {
  const refs = useBeatRefs();
  useBeatLifecycle(refs);
  useOpeningBeat(refs);
  return { attack: useBeatAttack(), endTurn: useBeatStart(refs) };
}
