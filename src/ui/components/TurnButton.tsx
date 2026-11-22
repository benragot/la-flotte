import type { CombatPhase } from "../../engine/combatLoop/types";
import { useCombatStore } from "../../store/useCombatStore";

const ROUND_BUTTON =
  "pointer-events-auto -mt-2 self-center rounded-full border-2 border-[#8c6d46] bg-[#b83b3b] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#e8dcc8] shadow-lg transition hover:bg-[#d4a537] hover:text-[#2b241d] disabled:opacity-40";

/** Gros bouton rond saillant : c'est le pendant visuel du raccourci Espace. */
export default function TurnButton({ phase }: { phase: CombatPhase }) {
  const endTurn = useCombatStore((state) => state.endTurn);
  return (
    <button type="button" onClick={endTurn} disabled={phase !== "player_turn"} className={ROUND_BUTTON}>
      Passer (Espace)
    </button>
  );
}
