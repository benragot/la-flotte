import type { CombatRewards } from "../../../engine/combatLoop/types";
import type { BattleState } from "../../../engine/multiCombat";
import { battleOutcome } from "../../../store/battleSelectors";
import EndOverlay from "../EndOverlay";

/**
 * ARCH-02 : fin du combat d'**exploration unifiée** uniquement.
 *
 * Le donjon garde sa propre notice de salle (`dungeonNotice`) et ses récompenses
 * y sont déjà résumées : l'exclure évite un second écran. Quand ce composant
 * s'affiche, son unique bouton appelle `returnToMap`, qui crédite zéro fois de
 * plus (garde `rewards` du store) — la défaite ne prétend aucun gain.
 */
const DEFEAT_NOTE = "Défaite : le héros est tombé, les PV sont restaurés.";

interface UnifiedEndOverlayProps {
  battle: BattleState;
  rewards: CombatRewards | null;
  /** Donjon ou combat hors exploration : aucune fin unifiée, la notice suffit. */
  excluded: boolean;
  onReturn: () => void;
}

export default function UnifiedEndOverlay({ battle, rewards, excluded, onReturn }: UnifiedEndOverlayProps) {
  if (excluded) return null;
  const outcome = battleOutcome(battle);
  if (outcome === null) return null;
  const note = outcome === "defeat" ? DEFEAT_NOTE : undefined;
  return <EndOverlay phase={outcome} rewards={rewards} onReturnToMap={onReturn} note={note} />;
}
