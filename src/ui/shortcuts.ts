import type { CombatPhase } from "../engine/combatLoop/types";

/**
 * Raccourcis clavier du HUD, résolus **uniquement depuis le `code`** de
 * l'événement clavier.
 *
 * Sur un clavier Mac AZERTY, la rangée 1–9 sans Shift produit une `key`
 * valant `&`, `é`, `"`, `'`, `(`, `-`, `è`, `_`, `ç` : un résolveur basé sur
 * la `key` ne déclencherait jamais les sorts. Le `code` renvoie
 * `Digit1`…`Digit9` quelle que soit la disposition physique.
 */
export type Shortcut =
  | { kind: "selectSpell"; index: number }
  | { kind: "endTurn" }
  | { kind: "cancelSpell" }
  | { kind: "none" };

export interface ShortcutInput {
  /** Le `code` de l'événement clavier, jamais sa `key`. */
  code: string;
  phase: CombatPhase;
  focusInTextField: boolean;
}

const DIGIT_PREFIX = "Digit";
const FIRST_SPELL_DIGIT = 1;
const LAST_SPELL_DIGIT = 9;
const END_TURN_CODES: readonly string[] = ["Space", "Spacebar"];
const CANCEL_CODE = "Escape";
const NONE: Shortcut = { kind: "none" };

function isPlayableDigit(digit: number): boolean {
  return Number.isInteger(digit) && digit >= FIRST_SPELL_DIGIT && digit <= LAST_SPELL_DIGIT;
}

/** `Digit1`…`Digit9` ⇒ index 0-based ; tout le reste ⇒ `null`. */
export function spellIndexFromCode(code: string): number | null {
  if (!code.startsWith(DIGIT_PREFIX)) return null;
  const digit = Number(code.slice(DIGIT_PREFIX.length));
  if (!isPlayableDigit(digit)) return null;
  return digit - FIRST_SPELL_DIGIT;
}

function inPlayerTurn(phase: CombatPhase): boolean {
  return phase === "player_turn";
}

function spellShortcut(index: number, phase: CombatPhase): Shortcut {
  return inPlayerTurn(phase) ? { kind: "selectSpell", index } : NONE;
}

function digitShortcut(input: ShortcutInput): Shortcut {
  const index = spellIndexFromCode(input.code);
  if (index === null) return NONE;
  return spellShortcut(index, input.phase);
}

function endTurnShortcut(input: ShortcutInput): Shortcut | null {
  if (!END_TURN_CODES.includes(input.code)) return null;
  return inPlayerTurn(input.phase) ? { kind: "endTurn" } : NONE;
}

export function resolveShortcut(input: ShortcutInput): Shortcut {
  if (input.focusInTextField) return NONE;
  if (input.code === CANCEL_CODE) return { kind: "cancelSpell" };
  return endTurnShortcut(input) ?? digitShortcut(input);
}
