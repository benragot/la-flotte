import type { EffectiveHp } from "../hudHp";
import { formatEffectiveHp } from "../hudHp";

interface HeroVitalsLineProps {
  hp: EffectiveHp;
  className: string;
}

/** Ligne de PV du HUD : le domaine effectif du moteur, jamais celui du niveau. */
export default function HeroVitalsLine({ hp, className }: HeroVitalsLineProps) {
  return <p className={className}>❤ {formatEffectiveHp(hp)}</p>;
}
