import { useEffect } from "react";
import type { CombatPhase, CombatState } from "../engine/combatLoop/types";
import type { ArenaMode } from "../renderer";
import { useCombatStore } from "../store/useCombatStore";
import type { Shortcut, ShortcutInput } from "./shortcuts";
import { resolveShortcut } from "./shortcuts";
import { slotLook } from "./spellSlotState";

export interface ShortcutContext {
  phase: CombatPhase;
  mode: ArenaMode;
  combat: CombatState | null;
  selectedSpellId: string | null;
  selectSpell: (spellId: string | null) => void;
  endTurn: () => void;
}

type ShortcutEffect = () => void;

/**
 * Cible minimale d'un `keydown` : seule compte la présence de `closest`, ce qui
 * garde la décision testable sans jsdom (le dépôt n'en a pas).
 */
export interface ShortcutKeyEvent {
  code: string;
  target?: unknown;
}

/** Contrôles dont Espace est le comportement natif (clic, saisie). */
export const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  '[role="button"]',
  '[contenteditable="true"]',
].join(", ");

const NATIVE_SPACE_CODES: readonly string[] = ["Space", "Spacebar"];

interface ClosestLike {
  closest: (selector: string) => unknown;
}

function hasClosest(target: unknown): target is ClosestLike {
  if (typeof target !== "object" || target === null) return false;
  return typeof (target as ClosestLike).closest === "function";
}

/** Vrai si la cible est (ou baigne dans) un contrôle dont Espace est le rôle natif. */
export function isInteractiveTarget(target: unknown): boolean {
  if (!hasClosest(target)) return false;
  return target.closest(INTERACTIVE_SELECTOR) !== null;
}

function isSpaceCode(code: string): boolean {
  return NATIVE_SPACE_CODES.includes(code);
}

function focusedElement(): unknown {
  if (typeof document === "undefined") return null;
  return document.activeElement;
}

function hasInteractiveFocus(event: ShortcutKeyEvent): boolean {
  return isInteractiveTarget(focusedElement()) || isInteractiveTarget(event.target);
}

/** Espace appartient au contrôle actif : le navigateur garde le clic natif. */
function yieldsSpace(event: ShortcutKeyEvent): boolean {
  return isSpaceCode(event.code) && hasInteractiveFocus(event);
}

function isTextField(target: Element | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

function focusInTextField(): boolean {
  if (typeof document === "undefined") return false;
  return isTextField(document.activeElement);
}

export function toShortcutContext(event: ShortcutKeyEvent, phase: CombatPhase): ShortcutInput {
  return { code: event.code, phase, focusInTextField: focusInTextField() };
}

function nextSelection(context: ShortcutContext, spellId: string): string | null {
  if (context.selectedSpellId === spellId) return null;
  return spellId;
}

/** Un sort dont l'effet n'existe pas encore ne doit pas entrer en sélection. */
function isUpcoming(combat: CombatState, spellId: string): boolean {
  const spell = combat.spellsById?.[spellId];
  return spell !== undefined && slotLook({ combat, selectedSpellId: null }, spell).state === "a-venir";
}

function spellIdAt(combat: CombatState | null, index: number): string | null {
  if (combat === null) return null;
  return combat.player.spellIds[index] ?? null;
}

function selectableId(combat: CombatState, spellId: string | null): string | null {
  if (spellId === null) return null;
  return isUpcoming(combat, spellId) ? null : spellId;
}

function spellAction(context: ShortcutContext, index: number): ShortcutEffect | null {
  const { combat } = context;
  if (combat === null) return null;
  const spellId = selectableId(combat, spellIdAt(combat, index));
  if (spellId === null) return null;
  const next = nextSelection(context, spellId);
  return () => context.selectSpell(next);
}

function isEndTurn(shortcut: Shortcut, context: ShortcutContext): boolean {
  return shortcut.kind === "endTurn" && context.mode === "combat";
}

export function applyShortcut(shortcut: Shortcut, context: ShortcutContext): ShortcutEffect | null {
  if (shortcut.kind === "selectSpell") return spellAction(context, shortcut.index);
  if (shortcut.kind === "cancelSpell") return () => context.selectSpell(null);
  if (isEndTurn(shortcut, context)) return context.endTurn;
  return null;
}

/** Décision pure d'un raccourci ; `null` quand le navigateur doit garder la main. */
export function shortcutForKey(event: ShortcutKeyEvent, context: ShortcutContext): ShortcutEffect | null {
  if (yieldsSpace(event)) return null;
  const shortcut = resolveShortcut(toShortcutContext(event, context.phase));
  return applyShortcut(shortcut, context);
}

function onKeyDown(event: KeyboardEvent, context: ShortcutContext): void {
  const effect = shortcutForKey(event, context);
  if (effect === null) return;
  event.preventDefault();
  effect();
}

function useShortcutContext(): ShortcutContext {
  const combat = useCombatStore((state) => state.combat);
  const mode = useCombatStore((state) => state.mode);
  const selectedSpellId = useCombatStore((state) => state.selectedSpellId);
  const selectSpell = useCombatStore((state) => state.selectSpell);
  const endTurn = useCombatStore((state) => state.endTurn);
  const phase = combat?.phase ?? "player_turn";
  return { phase, mode, combat, selectedSpellId, selectSpell, endTurn };
}

/** Écouteur clavier global unique : il remplace celui du HUD et couvre les deux modes. */
export function useGlobalShortcuts(): void {
  const context = useShortcutContext();
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event, context);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [context]);
}
