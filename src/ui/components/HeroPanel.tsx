import type { CombatantState } from "../../engine/combatLoop/types";
import HpBar from "./HpBar";

export default function HeroPanel({ player }: { player: CombatantState }) {
  return (
    <article aria-label={`Fiche de ${player.name}`} className="pointer-events-auto min-w-52 rounded border border-amber-700/60 bg-slate-900/85 px-3 py-2 text-slate-100">
      <h2 className="font-semibold text-amber-300">{player.name} · Niveau {player.level}</h2>
      <HpBar current={player.hp} max={player.maxHp} />
      <p className="text-xs">{player.ap} / {player.maxAp} PA · {player.mp} / {player.maxMp} PM</p>
    </article>
  );
}
