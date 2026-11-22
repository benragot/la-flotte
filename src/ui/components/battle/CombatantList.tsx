import type { BattleCombatantView } from "../../../renderer/battleViewModel";
import { CombatantCard } from "./CombatantCard";
import { BATTLE_LIST } from "./battleTheme";

export interface CombatantListProps {
  views: readonly BattleCombatantView[];
  onAttack: (targetId: string) => void;
}

function isHeroTurn(view: BattleCombatantView): boolean {
  return view.isActive && view.side === "player";
}

/** Les N combattants de `battle` ; l'action d'attaque n'apparaît qu'au tour du héros. */
export function CombatantList({ views, onAttack }: CombatantListProps) {
  const canAttack = views.some(isHeroTurn);
  return (
    <ul className={BATTLE_LIST}>
      {views.map((view) => <CombatantCard key={view.id} view={view} canAttack={canAttack} onAttack={onAttack} />)}
    </ul>
  );
}
