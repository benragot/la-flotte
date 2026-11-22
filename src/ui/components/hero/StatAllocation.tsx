import type { Hero } from "../../../engine/createHero";
import type { ClassDef, StatKey } from "../../../schemas/classSchema";
import { useGameStore } from "../../../store/useGameStore";
import type { StatOption } from "../../heroHudHelpers";
import { buildStatOptions } from "../../heroHudHelpers";
import { SECTION_HEADING } from "../hudTheme";

export interface StatAllocationProps {
  hero: Hero;
  classDef: ClassDef;
}

const PANEL =
  "pointer-events-auto flex w-full flex-col gap-1 rounded border border-[#8c6d46] bg-[#3d342a] px-2 py-1 text-[#e8dcc8]";
const ROW = "flex items-center gap-2 text-xs";
const CURRENT = "w-10 text-right tabular-nums";
const COST = "w-12 text-right text-[10px] tabular-nums text-[#d4a537]";
const PLUS =
  "h-6 w-6 rounded border border-[#8c6d46] bg-[#2b241d] text-sm font-bold text-[#e8dcc8] transition hover:bg-[#d4a537] hover:text-[#2b241d] disabled:opacity-40";

function useAllocator(): (stat: StatKey) => void {
  const allocateStat = useGameStore((state) => state.allocateStat);
  return (stat) => allocateStat({ stat, points: 1 });
}

function PlusButton({ option, onAllocate }: { option: StatOption; onAllocate: (stat: StatKey) => void }) {
  return (
    <button type="button" aria-label={`Ajouter un point en ${option.label}`} disabled={!option.affordable} onClick={() => onAllocate(option.stat)} className={PLUS}>
      +
    </button>
  );
}

function StatRow({ option, onAllocate }: { option: StatOption; onAllocate: (stat: StatKey) => void }) {
  return (
    <li className={ROW}>
      <span className="flex-1">{option.label}</span>
      <span className={CURRENT}>{option.current}</span>
      <span className={COST}>{option.cost} pt{option.cost > 1 ? "s" : ""}</span>
      <PlusButton option={option} onAllocate={onAllocate} />
    </li>
  );
}

function StatList({ options, onAllocate }: { options: readonly StatOption[]; onAllocate: (stat: StatKey) => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {options.map((option) => (
        <StatRow key={option.stat} option={option} onAllocate={onAllocate} />
      ))}
    </ul>
  );
}

/** Les six caractéristiques avec le coût exact du prochain point et le capital restant. */
export default function StatAllocation({ hero, classDef }: StatAllocationProps) {
  const allocate = useAllocator();
  const options = buildStatOptions({ hero, classDef });
  return (
    <section aria-label="Répartition des points de capital" className={PANEL}>
      <p className={SECTION_HEADING}>Points restants : {hero.capitalPoints}</p>
      <StatList options={options} onAllocate={allocate} />
    </section>
  );
}
