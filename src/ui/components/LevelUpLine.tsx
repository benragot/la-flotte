import type { LevelUpGain } from "../../engine/economy";

/**
 * Montée de niveau : une ligne informative, en or du thème (`line-gold`,
 * 5,36:1 sur le parchemin). Plus de `text-amber-200` (I9) ni de fanfare.
 */
export default function LevelUpLine({ gain }: { gain: LevelUpGain }) {
  return (
    <p className="text-[11px] font-bold leading-4 text-[var(--color-line-gold)]">
      Montée de niveau : PV +{gain.hp} · capital +{gain.capitalPoints} · sorts +{gain.spellPoints}
    </p>
  );
}
