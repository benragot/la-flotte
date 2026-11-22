import type { CombatState } from "../../engine/combatLoop/types";
import { formatHpBar } from "../hudHelpers";
import { DOCK_PANEL } from "./hudTheme";

type VitalTone = "hp" | "ap" | "mp";

interface VitalStatProps {
  icon: string;
  tone: VitalTone;
  /** Suffixe de lisibilité Dofus : « PA », « PM », vide pour les PV. */
  suffix: string;
  current: number;
  max: number;
}

const TONE_CLASS: Record<VitalTone, string> = {
  hp: "text-[#b83b3b]",
  ap: "text-[#3b6fb8]",
  mp: "text-[#4a8c4a]",
};

function VitalStat({ icon, tone, suffix, current, max }: VitalStatProps) {
  const value = formatHpBar(current, max);
  return (
    <span className={`flex items-center gap-1 text-sm font-bold ${TONE_CLASS[tone]}`}>
      <span aria-hidden="true">{icon}</span>
      <span>{value.text}{suffix}</span>
    </span>
  );
}

/** Les trois compteurs ne se disputent pas la place : ils passent à la ligne. */
function VitalRow({ combat }: { combat: CombatState }) {
  const { player } = combat;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <VitalStat icon="❤" tone="hp" suffix="" current={player.hp} max={player.maxHp} />
      <VitalStat icon="★" tone="ap" suffix=" PA" current={player.ap} max={player.maxAp} />
      <VitalStat icon="👢" tone="mp" suffix=" PM" current={player.mp} max={player.maxMp} />
    </div>
  );
}

/**
 * Zone `vitals` : **uniquement** les compteurs PV/PA/PM. L'action de tour a sa
 * propre colonne (`turn`), sinon le bouton recouvre les chiffres.
 */
export default function Vitals({ combat }: { combat: CombatState }) {
  return (
    <section aria-label="Ressources du héros" className={`${DOCK_PANEL} justify-center`}>
      <VitalRow combat={combat} />
    </section>
  );
}
