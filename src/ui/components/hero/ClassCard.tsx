import type { ClassDef } from "../../../schemas/classSchema";
import { classSummary } from "../../heroHudHelpers";

export interface ClassCardProps {
  classDef: ClassDef;
  selected: boolean;
  onSelect: (classId: string) => void;
}

const CARD = "flex flex-col gap-1 rounded border-2 px-2 py-1 text-left text-[#e8dcc8] transition";
const IDLE = "border-[#8c6d46] bg-[#3d342a] hover:border-[#d4a537]";
const PICKED = "border-[#d4a537] bg-[#2b241d]";

const STATS = "flex justify-between text-[10px] tabular-nums opacity-80";

const BASE_KEYS = ["basePa", "basePm", "baseHp", "basePp"] as const;

const BASE_LABELS = { basePa: "PA", basePm: "PM", baseHp: "PV", basePp: "PP" } as const;

function BaseStats({ classDef }: { classDef: ClassDef }) {
  const summary = classSummary(classDef);
  return (
    <span className={STATS}>
      {BASE_KEYS.map((key) => (
        <span key={key}>{BASE_LABELS[key]} {summary[key]}</span>
      ))}
    </span>
  );
}

/** Carte cliquable d'une classe : nom et quatre stats de base issues du YAML. */
export default function ClassCard({ classDef, selected, onSelect }: ClassCardProps) {
  return (
    <button type="button" aria-pressed={selected} onClick={() => onSelect(classDef.id)} className={`${CARD} ${selected ? PICKED : IDLE}`}>
      <span className="text-sm font-bold">{classDef.name}</span>
      <BaseStats classDef={classDef} />
    </button>
  );
}
