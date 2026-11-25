import { useMemo } from "react";
import type { BattleState } from "../../engine/multiCombat";
import type { SpellDef } from "../../schemas/spellSchema";
import { battleSpellSlots } from "../../store/battleSpells";
import type { BattleSlotState, BattleSpellSlot } from "../../store/battleSpells";
import { useCombatStore } from "../../store/useCombatStore";
import { SPELL_SLOT_COUNT } from "../hudHelpers";
import { SPELL_CATALOG } from "../spellCatalog";
import { slotReason } from "../spellSlotState";
import type { SlotLook, SlotState } from "../spellSlotState";
import { SpellSlotPanel } from "./SpellSlots";
import type { SlotView } from "./SpellSlots";

/**
 * DEC-12 étape 3b : la barre de sorts du combat unifié.
 *
 * Aucun langage visuel nouveau : les six états du sélecteur empruntent les
 * faces du 1v1 (`SlotState`), et la grille est `SpellSlotPanel`, le composant
 * partagé avec `SpellSlots`. Le rendu ne calcule aucune règle de jeu.
 */
const VISUAL_STATE: Readonly<Record<BattleSlotState, SlotState>> = {
  disponible: "disponible",
  selectionne: "selectionne",
  "pa-insuffisants": "pa-insuffisants",
  "quota-epuise": "quota-epuise",
  "hors-portee": "hors-portee",
  "non-supporte": "a-venir",
  "pas-son-tour": "verrouille",
  "salle-terminee": "verrouille",
};

const EMPTY_LOOK: SlotLook = { state: "vide", disabled: true, badge: null, reason: null };

/** « Combat terminé » est propre à la bataille ; les autres causes sont partagées. */
function reasonOf(state: BattleSlotState): string | null {
  if (state === "salle-terminee") return "Combat terminé";
  return slotReason(VISUAL_STATE[state]);
}

function emptyView(index: number): SlotView {
  return { spell: null, index, look: EMPTY_LOOK };
}

/** Le motif long vient de la case (`slot.reason`) : téléportation, « à venir »… */
function spellView(slot: BattleSpellSlot, spells: readonly SpellDef[], index: number): SlotView {
  const spell = spells.find((entry) => entry.id === slot.spellId) ?? null;
  const state = VISUAL_STATE[slot.state];
  const look: SlotLook = { state, disabled: slot.disabled, badge: slot.badge, reason: slot.reason ?? reasonOf(slot.state) };
  return { spell, index, look };
}

export interface BattleSpellSlotsViewProps {
  battle: BattleState;
  selectedSpellId: string | null;
  spells: readonly SpellDef[];
}

function battleViews({ battle, selectedSpellId, spells }: BattleSpellSlotsViewProps): SlotView[] {
  const slots = battleSpellSlots({ battle, spells, selectedSpellId });
  const views = slots.map((slot, index) => spellView(slot, spells, index));
  const padding = Array.from({ length: SPELL_SLOT_COUNT - views.length }, (_, offset) => emptyView(views.length + offset));
  return [...views, ...padding];
}

/** Vue pure (props seulement) : testable en rendu statique, sans store. */
export function BattleSpellSlotsView({ battle, selectedSpellId, spells }: BattleSpellSlotsViewProps) {
  const views = useMemo(() => battleViews({ battle, selectedSpellId, spells }), [battle, selectedSpellId, spells]);
  return <SpellSlotPanel views={views} />;
}

/** Câblage : lit la bataille unifiée et le sort armé, rien d'autre. */
export default function BattleSpellSlots() {
  const battle = useCombatStore((state) => state.battle);
  const selectedSpellId = useCombatStore((state) => state.selectedSpellId);
  if (battle === null) return null;
  return <BattleSpellSlotsView battle={battle} selectedSpellId={selectedSpellId} spells={SPELL_CATALOG} />;
}
