import { useEffect } from "react";
import type { CombatPhase, CombatState } from "../engine/combatLoop/types";
import type { ArenaMode } from "../renderer";
import { useCombatStore } from "../store/useCombatStore";
import type { Shortcut, ShortcutInput } from "./shortcuts";
import { resolveShortcut } from "./shortcuts";

export interface ShortcutContext {
  phase: CombatPhase;
  mode: ArenaMode;
  combat: CombatState | null;
  selectedSpellId: string | null;
  selectSpell: (spellId: string | null) => void;
  endTurn: () => void;
}

type ShortcutEffect = () => void;

function isTextField(target: Element | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

function focusInTextField(): boolean {
  if (typeof document === "undefined") return false;
  return isTextField(document.activeElement);
}

export function toShortcutContext(event: KeyboardEvent, phase: CombatPhase): ShortcutInput {
  return { code: event.code, phase, focusInTextField: focusInTextField() };
}

function nextSelection(context: ShortcutContext, spellId: string): string | null {
  if (context.selectedSpellId === spellId) return null;
  return spellId;
}

function spellAction(context: ShortcutContext, index: number): ShortcutEffect | null {
  const spellId = context.combat?.player.spellIds[index] ?? null;
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

function onKeyDown(event: KeyboardEvent, context: ShortcutContext): void {
  const shortcut = resolveShortcut(toShortcutContext(event, context.phase));
  const effect = applyShortcut(shortcut, context);
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
