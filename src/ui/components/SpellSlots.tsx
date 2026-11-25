import { useMemo } from "react";
import type { CombatState } from "../../engine/combatLoop/types";
import type { SpellDef } from "../../schemas/spellSchema";
import { useCombatStore } from "../../store/useCombatStore";
import { buildSpellSlots, formatSpellRange, shortcutNumberForSlot } from "../hudHelpers";
import type { SlotLook, SlotLookInput, SlotState } from "../spellSlotState";
import { slotFace, slotLook } from "../spellSlotState";
import { MICRO, PANEL_TITLE } from "../uiTokens";
import { DOCK_PANEL } from "./hudTheme";

interface SpellSlotsProps {
  combat: CombatState;
  selectedSpellId: string | null;
}

interface SlotView {
  spell: SpellDef | null;
  index: number;
  look: SlotLook;
}

const GRID = "grid min-h-0 flex-1 grid-cols-6 grid-rows-2 gap-1";

/** Coût PA : bleu de PA au repos, danger quand il manque des PA, tertiaire sinon. */
const COST_INK: Readonly<Record<SlotState, string>> = {
  vide: "",
  disponible: "text-[var(--color-ink-ap)]",
  selectionne: "text-[var(--color-ink-ap)]",
  "pa-insuffisants": "text-[var(--color-ink-danger)]",
  "hors-portee": "text-[var(--color-ink-3)]",
  "a-venir": "text-[var(--color-ink-3)]",
  "etat-non-gere": "text-[var(--color-ink-3)]",
  recharge: "text-[var(--color-ink-3)]",
  "quota-epuise": "text-[var(--color-ink-3)]",
  verrouille: "text-[var(--color-ink-3)]",
};

function slotTitle({ spell, look }: SlotView): string {
  if (spell === null) return "Emplacement vide";
  const base = `${spell.name} — ${spell.apCost} PA — ${formatSpellRange(spell)} — ${spell.description}`;
  return look.reason === null ? base : `${base} — ${look.reason}`;
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

function SlotBody({ spell, spaced }: { spell: SpellDef | null; spaced: boolean }) {
  if (spell === null) return null;
  return <strong className={`${spaced ? "mt-5" : "mt-3"} line-clamp-2 text-[10px] font-semibold leading-3`}>{spell.name}</strong>;
}

/** Badge court d'honnêteté : « à venir », « Recharge (n) » — jamais une couleur seule. */
function SlotBadge({ badge }: { badge: string | null }) {
  if (badge === null) return null;
  return <span className={`${MICRO} absolute right-0.5 top-0.5 max-w-[90%] truncate`}>{badge}</span>;
}

function SlotContent({ spell, index, look }: SlotView) {
  return (
    <>
      <span className={MICRO}>{shortcutNumberForSlot(index)}</span>
      <SlotBody spell={spell} spaced={look.badge !== null} />
      <SlotBadge badge={look.badge} />
      <SlotCost spell={spell} state={look.state} />
    </>
  );
}

/** Sélection d'une case : un second clic sur la même case la désélectionne. */
function useSlotToggle(spell: SpellDef | null, isSelected: boolean): () => void {
  const selectSpell = useCombatStore((store) => store.selectSpell);
  return () => selectSpell(isSelected ? null : (spell?.id ?? null));
}

function SlotTile({ spell, index, look }: SlotView) {
  const isSelected = look.state === "selectionne";
  const onToggle = useSlotToggle(spell, isSelected);
  const title = slotTitle({ spell, index, look });
  return (
    <button type="button" onClick={onToggle} disabled={look.disabled} aria-disabled={look.disabled} aria-pressed={isSelected} title={title} className={slotFace(look.state)}>
      <SlotContent spell={spell} index={index} look={look} />
    </button>
  );
}

/** Les douze états sont recalculés une fois par combat, pas à chaque case. */
function viewsOf(input: SlotLookInput): SlotView[] {
  return buildSpellSlots(input).map((spell, index) => ({ spell, index, look: slotLook(input, spell) }));
}

function SlotGrid({ combat, selectedSpellId }: SpellSlotsProps) {
  const input = { combat, selectedSpellId };
  const slots = useMemo(() => viewsOf(input), [combat, selectedSpellId]);
  return <div className={GRID}>{slots.map((slot) => <SlotTile key={slot.index} {...slot} />)}</div>;
}

/**
 * Grille 2 × 6 des sorts : numéro de raccourci, coût PA et état de lancement.
 * Chaque état a sa face, son filet et son encre — jamais une simple baisse
 * d'`opacity` (spec §2.4), et la cause est écrite dans l'infobulle.
 */
export default function SpellSlots({ combat, selectedSpellId }: SpellSlotsProps) {
  return (
    <section aria-label="Sorts disponibles" className={DOCK_PANEL}>
      <h2 className={PANEL_TITLE}>Sorts · touches 1 à 9</h2>
      <SlotGrid combat={combat} selectedSpellId={selectedSpellId} />
    </section>
  );
}
