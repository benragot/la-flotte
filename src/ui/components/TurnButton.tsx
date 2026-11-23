import type { CombatPhase } from "../../engine/combatLoop/types";
import { useCombatStore } from "../../store/useCombatStore";
import { BUTTON_GOLD } from "../uiTokens";

/**
 * Zone `turn` : le bouton occupe sa propre colonne du dock, largeur garantie
 * (`w-[120px]`), sans marge négative — plus aucun chevauchement avec les PA/PM.
 * C'est le pendant visuel du raccourci Espace.
 *
 * Quatre états **francs** (spec §2.2) : l'ancien `opacity-40` délavait le texte
 * désactivé au lieu de le peindre, et `shadow-lg` ajoutait un flou interdit.
 */
const TURN_BUTTON = `${BUTTON_GOLD} w-full uppercase leading-tight`;

export default function TurnButton({ phase }: { phase: CombatPhase }) {
  const endTurn = useCombatStore((state) => state.endTurn);
  return (
    <button type="button" onClick={endTurn} disabled={phase !== "player_turn"} className={TURN_BUTTON}>
      Passer (Espace)
    </button>
  );
}
