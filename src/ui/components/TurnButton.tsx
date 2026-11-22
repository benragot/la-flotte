import type { CombatPhase } from "../../engine/combatLoop/types";
import { useCombatStore } from "../../store/useCombatStore";

const TURN_BUTTON =
  "pointer-events-auto w-full rounded border-2 border-[#8c6d46] bg-[#b83b3b] px-2 py-2 text-[11px] font-bold uppercase leading-tight tracking-wide text-[#e8dcc8] shadow-lg transition hover:bg-[#d4a537] hover:text-[#2b241d] disabled:opacity-40";

/**
 * Zone `turn` : le bouton occupe sa propre colonne du dock, largeur garantie
 * (`w-[120px]`), sans marge négative — plus aucun chevauchement avec les PA/PM.
 * C'est le pendant visuel du raccourci Espace.
 */
export default function TurnButton({ phase }: { phase: CombatPhase }) {
  const endTurn = useCombatStore((state) => state.endTurn);
  return (
    <button type="button" onClick={endTurn} disabled={phase !== "player_turn"} className={TURN_BUTTON}>
      Passer (Espace)
    </button>
  );
}
