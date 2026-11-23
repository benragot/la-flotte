import { formatHpBar } from "../hudHelpers";
import {
  AP_METER,
  AP_METER_FILL,
  HP_METER,
  HP_METER_FILL,
  MP_METER,
  MP_METER_FILL,
  VALUE,
} from "../uiTokens";

export type VitalTone = "hp" | "ap" | "mp";

interface VitalMeterProps {
  /** Libellé Dofus : « PV », « PA », « PM ». */
  label: string;
  tone: VitalTone;
  current: number;
  max: number;
}

/**
 * Les chiffres prennent les **encres** d'élément, jamais les remplissages :
 * `#B83B3B` en texte sur `surface-2` ne pèse que 2.16:1 (spec §1.6). Les
 * remplissages restent pour les barres.
 */
const INK: Readonly<Record<VitalTone, string>> = {
  hp: "text-[var(--color-ink-danger)]",
  ap: "text-[var(--color-ink-ap)]",
  mp: "text-[var(--color-ink-mp)]",
};

const TRACK: Readonly<Record<VitalTone, string>> = { hp: HP_METER, ap: AP_METER, mp: MP_METER };
const FILL: Readonly<Record<VitalTone, string>> = { hp: HP_METER_FILL, ap: AP_METER_FILL, mp: MP_METER_FILL };

function MeterFill({ tone, percent }: { tone: VitalTone; percent: number }) {
  return <div className={FILL[tone]} style={{ width: `${percent}%` }} />;
}

/**
 * Une ressource du dock : libellé, chiffres tabulaires et barre sous le texte
 * (§2.3 : 8 px pour les PV, 6 px pour les PA/PM). Le pourcentage vient de
 * `formatHpBar` — aucune formule n'est refaite dans l'interface.
 */
export default function VitalMeter({ label, tone, current, max }: VitalMeterProps) {
  const { text, percent } = formatHpBar(current, max);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={`${VALUE} whitespace-nowrap ${INK[tone]}`}>{`${label} ${text}`}</span>
      <div className={TRACK[tone]}><MeterFill tone={tone} percent={percent} /></div>
    </div>
  );
}
