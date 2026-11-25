import type { CombatRewards } from "../../engine/combatLoop/types";
import DropList from "./DropList";
import LevelUpLine from "./LevelUpLine";

/**
 * Récompenses de fin de combat : trois lignes chiffrées, sans emphase.
 * `ink-2` (7,01:1 sur le parchemin) pour la lecture, `ink-1` pour les chiffres.
 *
 * ARC-02 : le combat d'exploration unifié ajoute deux champs au résumé crédité
 * (`levelBefore`, `kamas`). Le 1v1 ne les porte pas : sa ligne de niveau et sa
 * liste de butins restent **exactement** celles d'avant.
 */
const LINE = "text-[11px] leading-4 text-[var(--color-ink-2)]";
const VALUE = "font-mono font-bold tabular-nums text-[var(--color-ink-1)]";

function LegacyLevelLine({ rewards }: { rewards: CombatRewards }) {
  return (
    <p className={LINE}>Niveau <span className={VALUE}>{rewards.level}</span> · Prospection <span className={VALUE}>{rewards.prospection}</span></p>
  );
}

function LevelProgressLine({ rewards, levelBefore }: { rewards: CombatRewards; levelBefore: number }) {
  return (
    <p className={LINE}>
      Niveau <span className={VALUE}>{levelBefore}</span> → <span className={VALUE}>{rewards.level}</span>
      {" · Prospection "}<span className={VALUE}>{rewards.prospection}</span>
    </p>
  );
}

function LevelLine({ rewards }: { rewards: CombatRewards }) {
  if (rewards.levelBefore === undefined) return <LegacyLevelLine rewards={rewards} />;
  return <LevelProgressLine rewards={rewards} levelBefore={rewards.levelBefore} />;
}

function KamasLine({ kamas }: { kamas: number }) {
  return <p className={LINE}>Kamas : <span className={VALUE}>{kamas}</span></p>;
}

function XpLine({ rewards }: { rewards: CombatRewards }) {
  return (
    <p className={LINE}>XP gagnée : <span className={VALUE}>{rewards.xpGained}</span> (total <span className={VALUE}>{rewards.totalXp}</span>)</p>
  );
}

function GainsLines({ rewards }: { rewards: CombatRewards }) {
  return (
    <>
      <XpLine rewards={rewards} />
      <LevelLine rewards={rewards} />
      {rewards.kamas === undefined ? null : <KamasLine kamas={rewards.kamas} />}
      {rewards.levelUp === null ? null : <LevelUpLine gain={rewards.levelUp} />}
    </>
  );
}

export default function RewardsSummary({ rewards }: { rewards: CombatRewards }) {
  return (
    <div className="flex flex-col gap-0.5">
      <GainsLines rewards={rewards} />
      <DropList drops={rewards.drops} />
    </div>
  );
}
