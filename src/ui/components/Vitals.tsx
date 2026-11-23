import type { CombatState } from "../../engine/combatLoop/types";
import { formatHpBar } from "../hudHelpers";
import { DOCK_PANEL } from "./hudTheme";
import { VALUE } from "../uiTokens";

type VitalTone = "hp" | "ap" | "mp";

interface VitalStatProps {
  icon: string;
  tone: VitalTone;
  /** Suffixe de lisibilité Dofus : « PA », « PM », vide pour les PV. */
  suffix: string;
  current: number;
  max: number;
}

/**
 * Les chiffres utilisent les **encres** d'élément (`ink-danger`, `ink-ap`,
 * `ink-mp`), jamais les remplissages : `#B83B3B` en texte sur `surface-2` ne
 * pèse que 2.16:1 (spec §1.6). Les remplissages restent pour les barres.
 */
const TONE_CLASS: Record<VitalTone, string> = {
  hp: "text-[var(--color-ink-danger)]",
  ap: "text-[var(--color-ink-ap)]",
  mp: "text-[var(--color-ink-mp)]",
};

function VitalStat({ icon, tone, suffix, current, max }: VitalStatProps) {
  const value = formatHpBar(current, max);
  return (
    <span className={`flex items-center gap-1 ${VALUE} ${TONE_CLASS[tone]}`}>
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
