import type { BattleCombatantView } from "../../../renderer/battleViewModel";
import type { AttackButtonState } from "../../battle/attackButtonState";
import { CombatantCard } from "./CombatantCard";
import { BATTLE_LIST } from "./battleTheme";

export interface CombatantListProps {
  views: readonly BattleCombatantView[];
  /** État du bouton d'attaque, identique pour toutes les cibles du panneau. */
  attack: AttackButtonState;
  /** Soin armé (SPELL-04) : action sur la carte du héros, `null` hors soin. */
  self?: AttackButtonState | null;
  onAttack: (targetId: string) => void;
}

function isHeroTurn(view: BattleCombatantView): boolean {
  return view.isActive && view.side === "player" && view.hp > 0;
}

/** Les N combattants de `battle` ; l'action n'apparaît qu'au tour du héros. */
export function CombatantList({ views, attack, self = null, onAttack }: CombatantListProps) {
  const canAttack = views.some(isHeroTurn);
  return (
    <ul className={BATTLE_LIST}>
      {views.map((view) => (
        <CombatantCard key={view.id} view={view} canAttack={canAttack} attack={attack} self={self} onAttack={onAttack} />
      ))}
    </ul>
  );
}
