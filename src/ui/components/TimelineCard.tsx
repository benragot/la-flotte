import type { CombatantState } from "../../engine/combatLoop/types";
import { formatHpBar } from "../hudHelpers";

interface TimelineCardProps {
  combatant: CombatantState;
  isActive: boolean;
}

/** Largeur fixe : la bande d'initiative ne laisse pas deux cartes se chevaucher. */
const CARD_BASE = "w-60 min-w-0 shrink-0 rounded px-2 py-1";
const ACTIVE_CARD = `${CARD_BASE} border-2 border-[#d4a537] bg-[#3d342a] text-[#e8dcc8] shadow-[0_0_8px_#d4a537]`;
const IDLE_CARD = `${CARD_BASE} border border-[#8c6d46] bg-[#3d342a]/80 text-[#e8dcc8]/70`;

function cardClass(isActive: boolean): string {
  return isActive ? ACTIVE_CARD : IDLE_CARD;
}

function cardLabel(combatant: CombatantState): string {
  return `${combatant.name}, niveau ${combatant.level}`;
}

/** Mini barre de PV : la largeur en `style` est la seule valeur non statique. */
function MiniHpBar({ percent }: { percent: number }) {
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-[#2b241d]">
      <div className="h-full bg-[#b83b3b] transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

export default function TimelineCard({ combatant, isActive }: TimelineCardProps) {
  const hp = formatHpBar(combatant.hp, combatant.maxHp);
  return (
    <article aria-label={cardLabel(combatant)} data-combatant={combatant.id} className={cardClass(isActive)}>
      <p className="truncate text-[11px] font-semibold">{combatant.name}</p>
      <p className="text-[10px] opacity-80">Niv. {combatant.level} · {hp.text} PV</p>
      <MiniHpBar percent={hp.percent} />
    </article>
  );
}
