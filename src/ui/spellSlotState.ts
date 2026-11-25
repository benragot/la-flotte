import { isSpellAvailable, spellUsageKey } from "../engine/combat";
import { getCastableCells } from "../engine/combatLoop/castable";
import { spellSupportRefusal } from "../engine/combatLoop/spellSupport";
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
 * Les états d'une case de sort (spec §2.4) : disponible, sélectionné, à venir,
 * état non géré, recharge, quota épuisé, hors portée, PA insuffisants,
 * verrouillé — plus la case vide.
 *
 * Le HUD ne refait aucune règle : la géométrie vient de `getCastableCells`, les
 * quotas de `isSpellAvailable`, les refus de support de `spellSupportRefusal`.
 * Ici on **nomme la cause** pour que la case l'affiche autrement qu'en couleur.
 */
export type SlotState =
  | "vide"
  | "disponible"
  | "selectionne"
  | "a-venir"
  | "etat-non-gere"
  | "recharge"
  | "quota-epuise"
  | "hors-portee"
  | "pa-insuffisants"
  | "verrouille";

/** Ce que rend une case : l'état, son clic, son badge court et son motif long. */
export interface SlotLook {
  state: SlotState;
  disabled: boolean;
  badge: string | null;
  reason: string | null;
}

export interface SlotLookInput {
  combat: CombatState;
  selectedSpellId: string | null;
}

const FACES: Readonly<Record<SlotState, string>> = {
  vide: SLOT_EMPTY,
  disponible: SLOT_IDLE,
  selectionne: SLOT_SELECTED,
  "a-venir": SLOT_LOCKED,
  "etat-non-gere": SLOT_LOCKED,
  recharge: SLOT_LOCKED,
  "quota-epuise": SLOT_LOCKED,
  "hors-portee": SLOT_OUT_OF_RANGE,
  "pa-insuffisants": SLOT_NO_AP,
  verrouille: SLOT_LOCKED,
};

const REASONS: Readonly<Partial<Record<SlotState, string>>> = {
  "a-venir": "Effet pas encore implémenté",
  "etat-non-gere": "État non géré par le moteur",
  "quota-epuise": "Quota du tour épuisé",
  "hors-portee": "Hors portée",
  "pa-insuffisants": "PA insuffisants",
  verrouille: "Tour adverse",
};

const EMPTY_LOOK: SlotLook = { state: "vide", disabled: true, badge: null, reason: null };

/** Face d'une case : aucune teinte seule, chaque état garde son filet. */
export function slotFace(state: SlotState): string {
  return FACES[state];
}

/** Cause statique de l'état, pour les états dont le motif ne dépend pas du combat. */
export function slotReason(state: SlotState): string | null {
  return REASONS[state] ?? null;
}

/** Seules les cases disponible et sélectionnée émettent un clic. */
export function isSlotPlayable(state: SlotState): boolean {
  return state === "disponible" || state === "selectionne";
}

/** Tours de recharge restants : `0` = sort prêt. */
function cooldownLeft(combat: CombatState, spell: SpellDef): number {
  const usage = combat.spellUsage?.[spellUsageKey(combat.player.id, spell.id)];
  if (usage === undefined) return 0;
  return Math.max(0, usage.readyAt - combat.turn);
}

function quotaOpen(combat: CombatState, spell: SpellDef): boolean {
  const key = spellUsageKey(combat.player.id, spell.id);
  return isSpellAvailable({ usage: combat.spellUsage ?? {}, key, limit: spell, turn: combat.turn });
}

/** Aucune case légale pour ce sort depuis la position du joueur : hors portée. */
function outOfReach(combat: CombatState, spell: SpellDef): boolean {
  return getCastableCells(combat, spell.id).length === 0;
}

/** Un quota épuisé avec recharge armée affiche la recharge ; sinon le quota. */
function quotaState(combat: CombatState, spell: SpellDef): SlotState | null {
  if (quotaOpen(combat, spell)) return null;
  return cooldownLeft(combat, spell) > 0 ? "recharge" : "quota-epuise";
}

function intrinsicBlock(spell: SpellDef): SlotState | null {
  const refusal = spellSupportRefusal(spell);
  if (refusal === "missing-state") return "etat-non-gere";
  return refusal === "not-implemented" ? "a-venir" : null;
}

function apBlock(combat: CombatState, spell: SpellDef): SlotState | null {
  if (combat.player.ap < spell.apCost) return "pa-insuffisants";
  return outOfReach(combat, spell) ? "hors-portee" : null;
}

/** Blocages liés au tour et au quota : ils gagnent sur la sélection. */
function gateBlock(combat: CombatState, spell: SpellDef): SlotState | null {
  if (combat.phase !== "player_turn") return "verrouille";
  return quotaState(combat, spell);
}

function playableState(input: SlotLookInput, spell: SpellDef): SlotState {
  if (spell.id === input.selectedSpellId) return "selectionne";
  return "disponible";
}

/**
 * La recharge et le quota gagnent sur la sélection ; la portée et les PA la
 * laissent peindre (le joueur sélectionne pour lire la zone). Aucun état ne
 * peut contredire un refus intrinsèque du moteur.
 */
function stateOf(input: SlotLookInput, spell: SpellDef): SlotState {
  const intrinsic = intrinsicBlock(spell);
  if (intrinsic !== null) return intrinsic;
  const gate = gateBlock(input.combat, spell);
  if (gate !== null) return gate;
  return apBlock(input.combat, spell) ?? playableState(input, spell);
}

function badgeOf(combat: CombatState, spell: SpellDef, state: SlotState): string | null {
  if (state === "a-venir") return "à venir";
  if (state === "etat-non-gere") return "état non géré";
  return state === "recharge" ? `Recharge (${cooldownLeft(combat, spell)})` : null;
}

function reasonOf(combat: CombatState, spell: SpellDef, state: SlotState): string | null {
  if (state === "recharge") return `Recharge (${cooldownLeft(combat, spell)})`;
  return REASONS[state] ?? null;
}

/** État exposé à la case : clic autorisé, badge visible et motif d'infobulle. */
export function slotLook(input: SlotLookInput, spell: SpellDef | null): SlotLook {
  if (spell === null) return EMPTY_LOOK;
  const state = stateOf(input, spell);
  const disabled = !isSlotPlayable(state);
  return { state, disabled, badge: badgeOf(input.combat, spell, state), reason: reasonOf(input.combat, spell, state) };
}

/** État seul, conservé pour les appels qui n'ont besoin que de la face. */
export function slotStateOf(input: SlotLookInput, spell: SpellDef | null): SlotState {
  return slotLook(input, spell).state;
}
