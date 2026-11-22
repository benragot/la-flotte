import type { CombatantState, CombatPhase } from "../../engine/combatLoop/types";
import TimelineCard from "./TimelineCard";

interface TimelineProps {
  player: CombatantState;
  enemy: CombatantState;
  phase: CombatPhase;
}

/**
 * Zone `initiative` : une bande horizontale **dans le flux**, sous le bandeau.
 * L'ancien `absolute right-0 top-0` recouvrait le titre et débordait sur le
 * dock des sorts.
 */
const SHELL = "pointer-events-auto flex items-start gap-2 px-3 py-1";

type ActiveKind = "player" | "enemy" | null;

function activeKind(phase: CombatPhase): ActiveKind {
  if (phase === "player_turn") return "player";
  if (phase === "enemy_turn") return "enemy";
  return null;
}

/** Ordre de jeu : joueur puis adversaire, côte à côte dans la bande d'initiative. */
export default function Timeline({ player, enemy, phase }: TimelineProps) {
  const active = activeKind(phase);
  return (
    <aside aria-label="Ordre de jeu" data-zone="initiative" className={SHELL}>
      <TimelineCard combatant={player} isActive={active === "player"} />
      <TimelineCard combatant={enemy} isActive={active === "enemy"} />
    </aside>
  );
}
