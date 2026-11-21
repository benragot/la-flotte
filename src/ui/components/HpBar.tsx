import { formatHpBar } from "../hudHelpers";

interface HpBarProps {
  current: number;
  max: number;
}

/** Barre de PV : reste lisible sans CSS grâce au texte explicite. */
export default function HpBar({ current, max }: HpBarProps) {
  const hp = formatHpBar(current, max);
  return (
    <div role="progressbar" aria-valuenow={hp.percent} aria-valuemin={0} aria-valuemax={100} className="relative h-3 w-full overflow-hidden rounded bg-slate-800">
      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${hp.percent}%` }} />
      <span className="absolute inset-0 text-center text-[10px] leading-3 text-slate-100">{hp.text} PV</span>
    </div>
  );
}
