import type { CombatantState, CombatPhase } from "../../engine/combatLoop/types";
import TimelineCard from "./TimelineCard";

interface TimelineProps {
  player: CombatantState;
  enemy: CombatantState;
  phase: CombatPhase;
}

const SHELL =
  "pointer-events-auto absolute right-0 top-0 z-10 flex w-40 flex-col gap-1 p-1";

type ActiveKind = "player" | "enemy" | null;

function activeKind(phase: CombatPhase): ActiveKind {
  if (phase === "player_turn") return "player";
  if (phase === "enemy_turn") return "enemy";
  return null;
}

/** Ordre de jeu vertical, à droite de la zone libre : joueur puis adversaire. */
export default function Timeline({ player, enemy, phase }: TimelineProps) {
  const active = activeKind(phase);
  return (
    <aside aria-label="Ordre de jeu" className={SHELL}>
      <TimelineCard combatant={player} isActive={active === "player"} />
      <TimelineCard combatant={enemy} isActive={active === "enemy"} />
    </aside>
  );
}
