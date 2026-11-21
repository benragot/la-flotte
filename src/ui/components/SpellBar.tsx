import type { CombatState } from "../../engine/combatLoop/types";
import type { SpellDef } from "../../schemas/spellSchema";
import { useCombatStore } from "../../store/useCombatStore";
import { canCastSpell, formatSpellRange } from "../hudHelpers";

interface SpellSlotProps {
  combat: CombatState;
  spellId: string;
}

interface SpellButtonProps {
  spell: SpellDef;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: () => void;
}

const PANEL = "pointer-events-auto rounded border border-slate-700/60 bg-slate-900/85 px-3 py-2 text-slate-100";
const HEADING = "text-xs uppercase tracking-widest text-slate-400";

function SpellButton({ spell, isSelected, isDisabled, onToggle }: SpellButtonProps) {
  const stateClasses = isSelected ? "border-amber-300 bg-amber-500/20" : "border-slate-700 bg-slate-800/80";
  return (
    <button type="button" onClick={onToggle} disabled={isDisabled} aria-pressed={isSelected} className={`rounded border px-3 py-1 text-left disabled:opacity-40 ${stateClasses}`}>
      <strong className="block text-sm">{spell.name}</strong>
      <span className="text-[11px] text-slate-300">{spell.apCost} PA · {formatSpellRange(spell)}</span>
    </button>
  );
}

function SpellSlot({ combat, spellId }: SpellSlotProps) {
  const selectedId = useCombatStore((state) => state.selectedSpellId);
  const selectSpell = useCombatStore((state) => state.selectSpell);
  const spell = combat.spellsById[spellId];
  if (spell === undefined) return null;
  const isSelected = selectedId === spellId;
  const onToggle = () => selectSpell(isSelected ? null : spellId);
  const isDisabled = !canCastSpell({ spell, combat });
  return <SpellButton spell={spell} isSelected={isSelected} isDisabled={isDisabled} onToggle={onToggle} />;
}

export default function SpellBar({ combat }: { combat: CombatState }) {
  return (
    <section aria-label="Sorts disponibles" className={PANEL}>
      <h2 className={HEADING}>Sorts</h2>
      <div className="flex flex-wrap gap-2">
        {combat.player.spellIds.map((spellId) => <SpellSlot key={spellId} combat={combat} spellId={spellId} />)}
      </div>
    </section>
  );
}
