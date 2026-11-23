import { useMemo } from "react";
import type { CombatState } from "../../engine/combatLoop/types";
import type { SpellDef } from "../../schemas/spellSchema";
import { useCombatStore } from "../../store/useCombatStore";
import { buildSpellSlots, formatSpellRange, shortcutNumberForSlot } from "../hudHelpers";
import type { SlotLookInput, SlotState } from "../spellSlotState";
import { slotFace, slotReason, slotStateOf } from "../spellSlotState";
import { MICRO, PANEL_TITLE } from "../uiTokens";
import { DOCK_PANEL } from "./hudTheme";

interface SpellSlotsProps {
  combat: CombatState;
  selectedSpellId: string | null;
}

interface SlotView {
  spell: SpellDef | null;
  index: number;
  state: SlotState;
}

const GRID = "grid min-h-0 flex-1 grid-cols-6 grid-rows-2 gap-1";

/** Coût PA : bleu de PA au repos, danger quand il manque des PA, tertiaire sinon. */
const COST_INK: Readonly<Record<SlotState, string>> = {
  vide: "",
  disponible: "text-[var(--color-ink-ap)]",
  selectionne: "text-[var(--color-ink-ap)]",
  "pa-insuffisants": "text-[var(--color-ink-danger)]",
  "hors-portee": "text-[var(--color-ink-3)]",
  verrouille: "text-[var(--color-ink-3)]",
};

/** Disponible et sélectionné sont les deux seules cases sur lesquelles on clique. */
function playable(state: SlotState): boolean {
  return state === "disponible" || state === "selectionne";
}

function slotTitle({ spell, state }: SlotView): string {
  if (spell === null) return "Emplacement vide";
  const base = `${spell.name} — ${spell.apCost} PA — ${formatSpellRange(spell)} — ${spell.description}`;
  const reason = slotReason(state);
  return reason === null ? base : `${base} — ${reason}`;
}

/**
 * Le coût PA reste **écrit** dans tous les états, et rappelé dans l'infobulle.
 * Il porte un creux de 1 px : sans lui, « Pression3 » se lit comme un seul mot
 * sur une case de 64 px (mesuré à 1024×768).
 */
function SlotCost({ spell, state }: { spell: SpellDef | null; state: SlotState }) {
  if (spell === null) return null;
  const chip = "absolute bottom-0.5 right-1 rounded-[1px] bg-[var(--color-surface-inset)] px-0.5";
  return <span className={`${chip} font-mono text-[10px] font-bold leading-3 ${COST_INK[state]}`}>{spell.apCost}</span>;
}

function SlotBody({ spell }: { spell: SpellDef | null }) {
  if (spell === null) return null;
  return <strong className="mt-3 line-clamp-2 text-[10px] font-semibold leading-3">{spell.name}</strong>;
}

function SlotContent({ spell, index, state }: SlotView) {
  return (
    <>
      <span className={MICRO}>{shortcutNumberForSlot(index)}</span>
      <SlotBody spell={spell} />
      <SlotCost spell={spell} state={state} />
    </>
  );
}

/** Sélection d'une case : un second clic sur la même case la désélectionne. */
function useSlotToggle(spell: SpellDef | null, isSelected: boolean): () => void {
  const selectSpell = useCombatStore((store) => store.selectSpell);
  return () => selectSpell(isSelected ? null : (spell?.id ?? null));
}

function SlotTile({ spell, index, state }: SlotView) {
  const isSelected = state === "selectionne";
  const onToggle = useSlotToggle(spell, isSelected);
  const title = slotTitle({ spell, index, state });
  return (
    <button type="button" onClick={onToggle} disabled={!playable(state)} aria-pressed={isSelected} title={title} className={slotFace(state)}>
      <SlotContent spell={spell} index={index} state={state} />
    </button>
  );
}

/** Les douze états sont recalculés une fois par combat, pas à chaque case. */
function viewsOf(input: SlotLookInput): SlotView[] {
  return buildSpellSlots(input).map((spell, index) => ({ spell, index, state: slotStateOf(input, spell) }));
}

function SlotGrid({ combat, selectedSpellId }: SpellSlotsProps) {
  const input = { combat, selectedSpellId };
  const slots = useMemo(() => viewsOf(input), [combat, selectedSpellId]);
  return <div className={GRID}>{slots.map((slot) => <SlotTile key={slot.index} {...slot} />)}</div>;
}

/**
 * Grille 2 × 6 des sorts : numéro de raccourci, coût PA et état de lancement.
 * Cinq états francs, chacun avec sa face, son filet et son encre — jamais une
 * simple baisse d'`opacity` (spec §2.4), et la cause est écrite dans l'infobulle.
 */
export default function SpellSlots({ combat, selectedSpellId }: SpellSlotsProps) {
  return (
    <section aria-label="Sorts disponibles" className={DOCK_PANEL}>
      <h2 className={PANEL_TITLE}>Sorts · touches 1 à 9</h2>
      <SlotGrid combat={combat} selectedSpellId={selectedSpellId} />
    </section>
  );
}
