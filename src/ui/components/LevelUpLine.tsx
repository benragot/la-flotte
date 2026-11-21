import type { LevelUpGain } from "../../engine/economy";

export default function LevelUpLine({ gain }: { gain: LevelUpGain }) {
  return (
    <p className="text-amber-200">
      Montée de niveau : PV +{gain.hp} · capital +{gain.capitalPoints} · sorts +{gain.spellPoints}
    </p>
  );
}
