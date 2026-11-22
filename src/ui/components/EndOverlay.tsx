import type { CombatPhase, CombatRewards } from "../../engine/combatLoop/types";
import { useCombatStore } from "../../store/useCombatStore";
import { isBattleOver, phaseLabel, shouldShowRewards } from "../hudHelpers";
import { PRIMARY_BUTTON } from "./hudTheme";
import RewardsSummary from "./RewardsSummary";

interface EndOverlayProps {
  phase: CombatPhase;
  rewards: CombatRewards | null;
  /** Action de retour carte ; le store ne l'expose pas encore (phase B). */
  onReturnToMap?: (() => void) | undefined;
}

interface EndBodyProps {
  phase: CombatPhase;
  rewards: CombatRewards | null;
  onReturn: () => void;
}

const SHELL =
  "pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#2b241d]/90 text-center text-[#e8dcc8]";

function RewardsBlock({ rewards }: { rewards: CombatRewards | null }) {
  if (rewards === null) return null;
  return <RewardsSummary rewards={rewards} />;
}

/** Fallback temporaire : `startDemoCombat` tant que le retour carte n'existe pas. */
function useReturnAction(onReturnToMap?: () => void): () => void {
  const startDemoCombat = useCombatStore((state) => state.startDemoCombat);
  return onReturnToMap ?? startDemoCombat;
}

function EndOverlayBody({ phase, rewards, onReturn }: EndBodyProps) {
  return (
    <section aria-label="Fin du combat" className={SHELL}>
      <h2 className="text-3xl font-bold text-[#d4a537]">{phaseLabel(phase)}</h2>
      {shouldShowRewards(phase, rewards) ? <RewardsBlock rewards={rewards} /> : null}
      <button type="button" onClick={onReturn} className={PRIMARY_BUTTON}>Retourner sur la carte</button>
    </section>
  );
}

export default function EndOverlay({ phase, rewards, onReturnToMap }: EndOverlayProps) {
  const onReturn = useReturnAction(onReturnToMap);
  if (!isBattleOver(phase)) return null;
  return <EndOverlayBody phase={phase} rewards={rewards} onReturn={onReturn} />;
}
