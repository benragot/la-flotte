import type { CombatPhase, CombatRewards } from "../../engine/combatLoop/types";
import { useCombatStore } from "../../store/useCombatStore";
import { isBattleOver, phaseLabel, shouldShowRewards } from "../hudHelpers";
import { BUTTON_GOLD } from "../uiTokens";
import { LAYER_END, OVERLAY_SHEET_NARROW, OVERLAY_TEXT, OVERLAY_TITLE } from "./overlayTheme";
import RewardsSummary from "./RewardsSummary";

/**
 * Fin de combat — « sobre : récompense, pas fanfare » (`ui-dofus-retro.md` §10).
 *
 * Ce qui a changé au lot 5 : plus de verdict en 30 px sans cadre posé à même le
 * HUD. Le verdict est le **titre de fenêtre** (18/24 Georgia, §2.5 `title`), la
 * feuille est la fenêtre modale unique (parchemin), et une seule sortie fait
 * quitter l'écran. Le voile est `--color-scrim`, l'arène reste lisible dessous.
 */
const SHELL = LAYER_END;
const SHEET = `${OVERLAY_SHEET_NARROW} items-start text-left`;

interface EndOverlayProps {
  phase: CombatPhase;
  rewards: CombatRewards | null;
  /** Action de retour carte ; l'écran unifié passe `returnToMap` du store. */
  onReturnToMap?: (() => void) | undefined;
  /** Ligne facultative sous le verdict (défaite unifiée) ; absente = rendu historique. */
  note?: string | undefined;
}

interface EndBodyProps {
  phase: CombatPhase;
  rewards: CombatRewards | null;
  onReturn: () => void;
  note?: string | undefined;
}

function RewardsBlock({ rewards }: { rewards: CombatRewards | null }) {
  if (rewards === null) return null;
  return <RewardsSummary rewards={rewards} />;
}

/** Fallback temporaire : `startDemoCombat` tant que le retour carte n'existe pas. */
function useReturnAction(onReturnToMap?: () => void): () => void {
  const startDemoCombat = useCombatStore((state) => state.startDemoCombat);
  return onReturnToMap ?? startDemoCombat;
}

function EndSheet({ phase, rewards, onReturn, note }: EndBodyProps) {
  return (
    <section aria-label="Fin du combat" className={SHEET}>
      <h2 className={OVERLAY_TITLE}>{phaseLabel(phase)}</h2>
      {note === undefined ? null : <p className={OVERLAY_TEXT}>{note}</p>}
      {shouldShowRewards(phase, rewards) ? <RewardsBlock rewards={rewards} /> : null}
      <button type="button" onClick={onReturn} className={BUTTON_GOLD}>Retourner sur la carte</button>
    </section>
  );
}

function EndOverlayBody({ phase, rewards, onReturn, note }: EndBodyProps) {
  return (
    <div className={SHELL}>
      <EndSheet phase={phase} rewards={rewards} onReturn={onReturn} note={note} />
    </div>
  );
}

export default function EndOverlay({ phase, rewards, onReturnToMap, note }: EndOverlayProps) {
  const onReturn = useReturnAction(onReturnToMap);
  if (!isBattleOver(phase)) return null;
  return <EndOverlayBody phase={phase} rewards={rewards} onReturn={onReturn} note={note} />;
}
