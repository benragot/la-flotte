import { getCastableCells } from "../engine/combatLoop/castable";
import type { CombatState } from "../engine/combatLoop/types";
import type { SpellDef } from "../schemas/spellSchema";
import {
  SLOT_EMPTY,
  SLOT_IDLE,
  SLOT_LOCKED,
  SLOT_NO_AP,
  SLOT_OUT_OF_RANGE,
  SLOT_SELECTED,
} from "./uiTokens";

/**
 * Les **cinq états francs** d'une case de sort (spec §2.4) : disponible,
 * sélectionné, hors portée, PA insuffisants, verrouillé — plus la case vide.
 *
 * Le HUD ne refait aucune règle : la géométrie vient de `getCastableCells`. Ici
 * on ne fait que **nommer la cause** pour que la case puisse la montrer autrement
 * qu'en couleur — la teinte seule n'est pas un état (deutéranopie).
 */
export type SlotState =
  | "vide"
  | "disponible"
  | "selectionne"
  | "hors-portee"
  | "pa-insuffisants"
  | "verrouille";

export interface SlotLookInput {
  combat: CombatState;
  selectedSpellId: string | null;
}

const FACES: Readonly<Record<SlotState, string>> = {
  vide: SLOT_EMPTY,
  disponible: SLOT_IDLE,
  selectionne: SLOT_SELECTED,
  "hors-portee": SLOT_OUT_OF_RANGE,
  "pa-insuffisants": SLOT_NO_AP,
  verrouille: SLOT_LOCKED,
};

const REASONS: Readonly<Partial<Record<SlotState, string>>> = {
  "hors-portee": "Hors portée",
  "pa-insuffisants": "PA insuffisants",
  verrouille: "Tour adverse",
};

/** Face d'une case : cinq classes **distinctes**, aucune ne réutilise une autre. */
export function slotFace(state: SlotState): string {
  return FACES[state];
}

/** Cause lisible de l'état, telle que la case la dit dans son infobulle. */
export function slotReason(state: SlotState): string | null {
  return REASONS[state] ?? null;
}

/** Aucune case légale pour ce sort depuis la position du joueur : hors portée. */
function outOfReach(combat: CombatState, spell: SpellDef): boolean {
  return getCastableCells(combat, spell.id).length === 0;
}

/**
 * Pourquoi la case est bloquée ; `null` = lançable. `canCastSpell` répond
 * oui/non, il ne dit pas **pourquoi** : le tour et les PA sont deux causes
 * distinctes que le joueur doit pouvoir distinguer d'un coup d'œil.
 */
function blockedState(combat: CombatState, spell: SpellDef): SlotState | null {
  if (combat.phase !== "player_turn") return "verrouille";
  if (combat.player.ap < spell.apCost) return "pa-insuffisants";
  return outOfReach(combat, spell) ? "hors-portee" : null;
}

/** État d'une case : la sélection l'emporte, elle est toujours visible. */
export function slotStateOf(input: SlotLookInput, spell: SpellDef | null): SlotState {
  if (spell === null) return "vide";
  if (spell.id === input.selectedSpellId) return "selectionne";
  return blockedState(input.combat, spell) ?? "disponible";
}
