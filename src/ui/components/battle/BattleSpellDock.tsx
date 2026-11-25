import BattleSpellSlots from "../BattleSpellSlots";
import { DOCK_SHELL } from "../../uiTokens";
import { DOCK_SPELLS } from "./battleTheme";

/** Le dock épouse son contenu, comme celui de l'exploration libre. */
const SHELL = "relative w-full shrink-0";

/**
 * Dock du combat d'exploration unifié : la barre de sorts seule, dans la
 * coquille du dock historique (`DOCK_SHELL`). `BattlePanel` garde le journal,
 * les combattants et la fin de tour — aucune zone n'est revendiquée deux fois.
 */
export default function BattleSpellDock() {
  return (
    <div className={SHELL} role="group" aria-label="Dock des sorts">
      <div className={DOCK_SHELL}>
        <div className={DOCK_SPELLS}><BattleSpellSlots /></div>
      </div>
    </div>
  );
}
