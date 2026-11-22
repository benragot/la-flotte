import type { CombatState } from "../../engine/combatLoop/types";
import type { SpellDef } from "../../schemas/spellSchema";
import { useCombatStore } from "../../store/useCombatStore";
import { buildSpellSlots, canCastSpell, formatSpellRange, shortcutNumberForSlot } from "../hudHelpers";
import { DOCK_PANEL, SECTION_HEADING } from "./hudTheme";

interface SpellSlotsProps {
  combat: CombatState;
  selectedSpellId: string | null;
}

interface SlotState {
  spell: SpellDef | null;
  index: number;
  isSelected: boolean;
  isDisabled: boolean;
}

interface SlotLook {
  isSelected: boolean;
  isDisabled: boolean;
  isEmpty: boolean;
}

const GRID = "grid min-h-0 flex-1 grid-cols-6 grid-rows-2 gap-1";

const TILE_STYLE = "relative flex flex-col items-start overflow-hidden rounded border text-left leading-none";

const TILE_EMPTY = `${TILE_STYLE} border-dashed border-[#8c6d46]/50 bg-[#2b241d]/40`;
const TILE_IDLE = `${TILE_STYLE} border-[#8c6d46] bg-[#2b241d] text-[#e8dcc8] hover:border-[#d4a537]`;
const TILE_SELECTED = `${TILE_STYLE} border-2 border-[#d4a537] bg-[#d4a537]/20 text-[#e8dcc8]`;
const TILE_DISABLED = `${TILE_STYLE} border-[#8c6d46]/40 bg-[#2b241d]/60 text-[#e8dcc8]/40`;

function slotClass(look: SlotLook): string {
  if (look.isEmpty) return TILE_EMPTY;
  if (look.isSelected) return TILE_SELECTED;
  return look.isDisabled ? TILE_DISABLED : TILE_IDLE;
}

function slotState(props: SpellSlotsProps, spell: SpellDef | null, index: number): SlotState {
  const { combat, selectedSpellId } = props;
  const isSelected = spell !== null && spell.id === selectedSpellId;
  const isDisabled = spell === null || !canCastSpell({ spell, combat });
  return { spell, index, isSelected, isDisabled };
}

function spellTitle(spell: SpellDef): string {
  return `${spell.name} — ${spell.apCost} PA — ${formatSpellRange(spell)} — ${spell.description}`;
}

function SlotCost({ spell }: { spell: SpellDef | null }) {
  if (spell === null) return null;
  return <span className="absolute bottom-0.5 right-1 text-[10px] font-bold text-[#3b6fb8]">{spell.apCost}</span>;
}

function SlotBody({ spell }: { spell: SpellDef | null }) {
  if (spell === null) return null;
  return <strong className="mt-3 line-clamp-2 text-[10px] leading-3">{spell.name}</strong>;
}

function SlotContent({ spell, index }: { spell: SpellDef | null; index: number }) {
  return (
    <>
      <span className="text-[9px] font-bold opacity-70">{shortcutNumberForSlot(index)}</span>
      <SlotBody spell={spell} />
      <SlotCost spell={spell} />
    </>
  );
}

function spellIdOf(spell: SpellDef | null): string | null {
  return spell?.id ?? null;
}

function nextSelection(spell: SpellDef | null, isSelected: boolean): string | null {
  return isSelected ? null : spellIdOf(spell);
}

function slotTitle(spell: SpellDef | null): string {
  return spell === null ? "Emplacement vide" : spellTitle(spell);
}

function SlotTile({ spell, index, isSelected, isDisabled }: SlotState) {
  const selectSpell = useCombatStore((state) => state.selectSpell);
  const onToggle = () => selectSpell(nextSelection(spell, isSelected));
  const look = { isSelected, isDisabled, isEmpty: spell === null };
  return (
    <button type="button" onClick={onToggle} disabled={isDisabled} aria-pressed={isSelected} title={slotTitle(spell)} className={slotClass(look)}>
      <SlotContent spell={spell} index={index} />
    </button>
  );
}

/** Grille 2 × 6 des sorts : numéro de raccourci, coût PA et état de lancement. */
export default function SpellSlots({ combat, selectedSpellId }: SpellSlotsProps) {
  return (
    <section aria-label="Sorts disponibles" className={DOCK_PANEL}>
      <h2 className={SECTION_HEADING}>Sorts · touches 1 à 9</h2>
      <div className={GRID}>
        {buildSpellSlots({ combat, selectedSpellId }).map((spell, index) => <SlotTile key={index} {...slotState({ combat, selectedSpellId }, spell, index)} />)}
      </div>
    </section>
  );
}
