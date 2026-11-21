import type { CombatPhase, CombatRewards } from "../../engine/combatLoop/types";
import { useCombatStore } from "../../store/useCombatStore";
import { isBattleOver, phaseLabel, shouldShowRewards } from "../hudHelpers";
import RewardsSummary from "./RewardsSummary";

interface EndOverlayProps {
  phase: CombatPhase;
  rewards: CombatRewards | null;
}

const SHELL = "pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 text-center text-slate-100";

function RewardsBlock({ rewards }: { rewards: CombatRewards | null }) {
  if (rewards === null) return null;
  return <RewardsSummary rewards={rewards} />;
}

function EndOverlayBody({ phase, rewards, onReplay }: EndOverlayProps & { onReplay: () => void }) {
  const showRewards = shouldShowRewards(phase, rewards);
  return (
    <section aria-label="Fin du combat" className={SHELL}>
      <h2 className="text-3xl font-bold text-amber-300">{phaseLabel(phase)}</h2>
      {showRewards ? <RewardsBlock rewards={rewards} /> : null}
      <button type="button" onClick={onReplay} className="rounded bg-amber-600 px-4 py-2 font-semibold text-slate-950">Rejouer le combat</button>
    </section>
  );
}

export default function EndOverlay({ phase, rewards }: EndOverlayProps) {
  const startDemoCombat = useCombatStore((state) => state.startDemoCombat);
  if (!isBattleOver(phase)) return null;
  return <EndOverlayBody phase={phase} rewards={rewards} onReplay={startDemoCombat} />;
}
