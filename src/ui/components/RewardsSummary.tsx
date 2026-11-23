import type { CombatRewards } from "../../engine/combatLoop/types";
import DropList from "./DropList";
import LevelUpLine from "./LevelUpLine";

/**
 * Récompenses de fin de combat : trois lignes chiffrées, sans emphase.
 * `ink-2` (7,01:1 sur le parchemin) pour la lecture, `ink-1` pour les chiffres.
 */
const LINE = "text-[11px] leading-4 text-[var(--color-ink-2)]";
const VALUE = "font-mono font-bold tabular-nums text-[var(--color-ink-1)]";

export default function RewardsSummary({ rewards }: { rewards: CombatRewards }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className={LINE}>XP gagnée : <span className={VALUE}>{rewards.xpGained}</span> (total <span className={VALUE}>{rewards.totalXp}</span>)</p>
      <p className={LINE}>Niveau <span className={VALUE}>{rewards.level}</span> · Prospection <span className={VALUE}>{rewards.prospection}</span></p>
      {rewards.levelUp === null ? null : <LevelUpLine gain={rewards.levelUp} />}
      <DropList drops={rewards.drops} />
    </div>
  );
}
