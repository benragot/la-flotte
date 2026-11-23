import type { Hero } from "../../../engine/createHero";
import type { ClassDef } from "../../../schemas/classSchema";
import { useGameStore } from "../../../store/useGameStore";
import type { StatOption } from "../../heroHudHelpers";
import { allocationPayload, buildStatOptions, formatSoftCapTier } from "../../heroHudHelpers";
import { SECTION_HEADING } from "../hudTheme";
import { ALLOCATION_CURRENT, ALLOCATION_PANEL, ALLOCATION_ROW, ALLOCATION_TIER, PLUS_BUTTON } from "./heroTheme";

export interface StatAllocationProps {
  hero: Hero;
  classDef: ClassDef;
}

function useAllocator(): (option: StatOption) => void {
  const allocateStat = useGameStore((state) => state.allocateStat);
  return (option) => allocateStat(allocationPayload(option));
}

function PlusButton({ option, onAllocate }: { option: StatOption; onAllocate: (option: StatOption) => void }) {
  return (
    <button type="button" aria-label={`Ajouter un point en ${option.label}`} disabled={!option.affordable} onClick={() => onAllocate(option)} className={PLUS_BUTTON}>
      +
    </button>
  );
}

function TierLabel({ option, classDef }: { option: StatOption; classDef: ClassDef }) {
  const tier = formatSoftCapTier({ softCaps: classDef.softCaps, stat: option.stat, value: option.current });
  return <span className={ALLOCATION_TIER}>{tier}</span>;
}

function StatRow({ option, classDef, onAllocate }: { option: StatOption; classDef: ClassDef; onAllocate: (option: StatOption) => void }) {
  return (
    <li className={ALLOCATION_ROW}>
      <span className="flex-1">{option.label}</span>
      <span className={ALLOCATION_CURRENT}>{option.current}</span>
      <TierLabel option={option} classDef={classDef} />
      <PlusButton option={option} onAllocate={onAllocate} />
    </li>
  );
}

function StatList({ options, classDef, onAllocate }: { options: readonly StatOption[]; classDef: ClassDef; onAllocate: (option: StatOption) => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {options.map((option) => (
        <StatRow key={option.stat} option={option} classDef={classDef} onAllocate={onAllocate} />
      ))}
    </ul>
  );
}

/** Les six caractéristiques : palier courant, coût exact et capital restant. */
export default function StatAllocation({ hero, classDef }: StatAllocationProps) {
  const allocate = useAllocator();
  const options = buildStatOptions({ hero, classDef });
  return (
    <section aria-label="Répartition des points de capital" className={ALLOCATION_PANEL}>
      <p className={SECTION_HEADING}>Points restants : {hero.capitalPoints}</p>
      <StatList options={options} classDef={classDef} onAllocate={allocate} />
    </section>
  );
}
