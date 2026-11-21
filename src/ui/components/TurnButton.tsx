import type { CombatPhase } from "../../engine/combatLoop/types";
import { useCombatStore } from "../../store/useCombatStore";

export default function TurnButton({ phase }: { phase: CombatPhase }) {
  const endTurn = useCombatStore((state) => state.endTurn);
  return (
    <button type="button" onClick={endTurn} disabled={phase !== "player_turn"} className="pointer-events-auto self-start rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">
      Passer le tour
    </button>
  );
}
