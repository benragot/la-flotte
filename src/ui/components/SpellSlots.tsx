import type { CombatState } from "../../engine/combatLoop/types";
import type { SpellDef } from "../../schemas/spellSchema";
import { useCombatStore } from "../../store/useCombatStore";
import { buildSpellSlots, canCastSpell, formatSpellRange, shortcutNumberForSlot } from "../hudHelpers";
import { MICRO, PANEL_TITLE, SLOT_DISABLED, SLOT_EMPTY, SLOT_IDLE, SLOT_SELECTED } from "../uiTokens";
import { DOCK_PANEL } from "./hudTheme";

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

const TILE_STYLE = "relative flex flex-col items-start overflow-hidden text-left leading-none";

function slotClass(look: SlotLook): string {
  if (look.isEmpty) return `${TILE_STYLE} ${SLOT_EMPTY}`;
  if (look.isSelected) return `${TILE_STYLE} ${SLOT_SELECTED}`;
  return `${TILE_STYLE} ${look.isDisabled ? SLOT_DISABLED : SLOT_IDLE}`;
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

/** Coût PA en encre d'Eau (`ink-ap`, 4.55:1) : le bleu de remplissage ne passe pas. */
function SlotCost({ spell }: { spell: SpellDef | null }) {
  if (spell === null) return null;
  return <span className="absolute bottom-0.5 right-1 font-mono text-[10px] font-bold leading-3 text-[var(--color-ink-ap)]">{spell.apCost}</span>;
}

function SlotBody({ spell }: { spell: SpellDef | null }) {
  if (spell === null) return null;
  return <strong className="mt-3 line-clamp-2 text-[10px] font-semibold leading-3">{spell.name}</strong>;
}

function SlotContent({ spell, index }: { spell: SpellDef | null; index: number }) {
  return (
    <>
      <span className={MICRO}>{shortcutNumberForSlot(index)}</span>
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

/**
 * Grille 2 × 6 des sorts : numéro de raccourci, coût PA et état de lancement.
 * Cinq états sans `opacity` (spec §2.4) : au repos, survol, sélectionné,
 * désactivé, vide — chacun avec sa face, son filet et son encre.
 */
export default function SpellSlots({ combat, selectedSpellId }: SpellSlotsProps) {
  return (
    <section aria-label="Sorts disponibles" className={DOCK_PANEL}>
      <h2 className={PANEL_TITLE}>Sorts · touches 1 à 9</h2>
      <div className={GRID}>
        {buildSpellSlots({ combat, selectedSpellId }).map((spell, index) => <SlotTile key={index} {...slotState({ combat, selectedSpellId }, spell, index)} />)}
      </div>
    </section>
  );
}
