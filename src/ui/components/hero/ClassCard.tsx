import type { ClassDef } from "../../../schemas/classSchema";
import { classSummary } from "../../heroHudHelpers";
import { CLASS_CARD_IDLE, CLASS_CARD_PICKED, CLASS_NAME, CLASS_STATS } from "./heroTheme";

export interface ClassCardProps {
  classDef: ClassDef;
  selected: boolean;
  onSelect: (classId: string) => void;
}

const BASE_KEYS = ["basePa", "basePm", "baseHp", "basePp"] as const;

const BASE_LABELS = { basePa: "PA", basePm: "PM", baseHp: "PV", basePp: "PP" } as const;

function BaseStats({ classDef }: { classDef: ClassDef }) {
  const summary = classSummary(classDef);
  return (
    <span className={CLASS_STATS}>
      {BASE_KEYS.map((key) => (
        <span key={key}>{BASE_LABELS[key]} {summary[key]}</span>
      ))}
    </span>
  );
}

/** Planche cliquable d'une classe : nom et quatre stats de base issues du YAML. */
export default function ClassCard({ classDef, selected, onSelect }: ClassCardProps) {
  return (
    <button type="button" aria-pressed={selected} onClick={() => onSelect(classDef.id)} className={selected ? CLASS_CARD_PICKED : CLASS_CARD_IDLE}>
      <span className={CLASS_NAME}>{classDef.name}</span>
      <BaseStats classDef={classDef} />
    </button>
  );
}
