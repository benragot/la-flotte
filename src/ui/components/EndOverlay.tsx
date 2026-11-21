import type { CombatPhase, CombatRewards } from "../../engine/combatLoop/types";
import { useCombatStore } from "../../store/useCombatStore";
import { isBattleOver, phaseLabel } from "../hudHelpers";
import RewardsSummary from "./RewardsSummary";

interface EndOverlayProps {
  phase: CombatPhase;
  rewards: CombatRewards | null;
}

interface EndOverlayBodyProps extends EndOverlayProps {
  onReplay: () => void;
}

const SHELL = "pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 text-center text-slate-100";

function EndOverlayBody({ phase, rewards, onReplay }: EndOverlayBodyProps) {
  const showRewards = phase === "victory" && rewards !== null;
  return (
    <section aria-label="Fin du combat" className={SHELL}>
      <h2 className="text-3xl font-bold text-amber-300">{phaseLabel(phase)}</h2>
      {showRewards ? <RewardsSummary rewards={rewards} /> : null}
      <button type="button" onClick={onReplay} className="rounded bg-amber-600 px-4 py-2 font-semibold text-slate-950">Rejouer le combat</button>
    </section>
  );
}

export default function EndOverlay({ phase, rewards }: EndOverlayProps) {
  const startDemoCombat = useCombatStore((state) => state.startDemoCombat);
  if (!isBattleOver(phase)) return null;
  return <EndOverlayBody phase={phase} rewards={rewards} onReplay={startDemoCombat} />;
}
