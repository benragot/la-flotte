import type { CombatantState } from "../../engine/combatLoop/types";
import HpBar from "./HpBar";

export default function EnemyPanel({ enemy }: { enemy: CombatantState }) {
  return (
    <article aria-label={`Fiche de ${enemy.name}`} className="pointer-events-auto min-w-52 rounded border border-rose-800/60 bg-slate-900/85 px-3 py-2 text-slate-100">
      <h2 className="font-semibold text-rose-300">{enemy.name} · Niveau {enemy.level}</h2>
      <HpBar current={enemy.hp} max={enemy.maxHp} />
    </article>
  );
}
