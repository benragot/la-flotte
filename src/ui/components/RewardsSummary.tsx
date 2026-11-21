import type { CombatRewards } from "../../engine/combatLoop/types";
import DropList from "./DropList";
import LevelUpLine from "./LevelUpLine";

export default function RewardsSummary({ rewards }: { rewards: CombatRewards }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm">XP gagnée : {rewards.xpGained} (total {rewards.totalXp})</p>
      <p className="text-sm">Niveau {rewards.level} · Prospection {rewards.prospection}</p>
      {rewards.levelUp === null ? null : <LevelUpLine gain={rewards.levelUp} />}
      <DropList drops={rewards.drops} />
    </div>
  );
}
