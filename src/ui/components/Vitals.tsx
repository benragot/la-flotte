import type { CombatState } from "../../engine/combatLoop/types";
import type { HudMode } from "../hudHelpers";
import { formatHpBar } from "../hudHelpers";
import { DOCK_PANEL } from "./hudTheme";
import TurnButton from "./TurnButton";

type VitalTone = "hp" | "ap" | "mp";

interface VitalStatProps {
  icon: string;
  tone: VitalTone;
  current: number;
  max: number;
}

const TONE_CLASS: Record<VitalTone, string> = {
  hp: "text-[#b83b3b]",
  ap: "text-[#3b6fb8]",
  mp: "text-[#4a8c4a]",
};

const BADGE =
  "rounded border border-dashed border-[#8c6d46] px-2 py-1 text-center text-[10px] leading-3 text-[#e8dcc8]/80";

function VitalStat({ icon, tone, current, max }: VitalStatProps) {
  const value = formatHpBar(current, max);
  return (
    <span className={`flex items-center gap-1 text-sm font-bold ${TONE_CLASS[tone]}`}>
      <span aria-hidden="true">{icon}</span>
      <span>{value.text}</span>
    </span>
  );
}

function VitalRow({ combat }: { combat: CombatState }) {
  const { player } = combat;
  return (
    <div className="flex items-center gap-3">
      <VitalStat icon="❤" tone="hp" current={player.hp} max={player.maxHp} />
      <VitalStat icon="★" tone="ap" current={player.ap} max={player.maxAp} />
      <VitalStat icon="👢" tone="mp" current={player.mp} max={player.maxMp} />
    </div>
  );
}

function ExplorationBadge() {
  return (
    <p className={BADGE}>
      Mode Exploration — Clique un monstre pour combattre
    </p>
  );
}

function ActionSlot({ combat, mode }: { combat: CombatState; mode: HudMode }) {
  if (mode === "exploration") return <ExplorationBadge />;
  return <TurnButton phase={combat.phase} />;
}

/** Cœur PV, étoile PA, botte PM puis l'action de tour (ou le badge d'exploration). */
export default function Vitals({ combat, mode }: { combat: CombatState; mode: HudMode }) {
  return (
    <section aria-label="Ressources du héros" className={DOCK_PANEL}>
      <VitalRow combat={combat} />
      <ActionSlot combat={combat} mode={mode} />
    </section>
  );
}
