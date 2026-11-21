import type { LootEntry, MonsterDef } from "../../schemas/monsterSchema";
import type { ProgressionDef } from "../../schemas/progressionSchema";
import type { LevelUpGain } from "../economy";
import {
  computeCombatXp,
  computeDropChance,
  computeLevelFromXp,
  computeProspection,
  getStatsGainForLevelUp,
} from "../economy";
import type { CombatRewards, CombatantState, Rng } from "./types";

export interface RewardsInput {
  heroXp: number;
  hero: CombatantState;
  monster: MonsterDef;
  progression: ProgressionDef;
  rng: Rng;
}

interface XpOutcome {
  xpGained: number;
  totalXp: number;
  level: number;
}

function xpOutcome(input: RewardsInput): XpOutcome {
  const baseMonsterXp = input.monster.baseXp;
  const wisdom = input.hero.stats.wisdom;
  const xpGained = computeCombatXp({ baseMonsterXp, wisdom, levelGapFactor: 1 });
  const totalXp = input.heroXp + xpGained;
  return { xpGained, totalXp, level: computeLevelFromXp(totalXp, input.progression.xpThresholds) };
}

function levelUpFor(input: RewardsInput, level: number): LevelUpGain | null {
  if (level <= input.hero.level) return null;
  return getStatsGainForLevelUp(level, input.progression.gainRules);
}

/** Un tirage `rng()` par entrée de butin, dans l'ordre du YAML. */
function rollDrop(entry: LootEntry, prospection: number, rng: Rng): boolean {
  const baseDropRate = entry.baseDropRate;
  const chance = computeDropChance({ playerPp: prospection, ppThreshold: entry.ppThreshold, baseDropRate });
  return rng() < chance;
}

function rollDrops(loot: readonly LootEntry[], prospection: number, rng: Rng): string[] {
  return loot.filter((entry) => rollDrop(entry, prospection, rng)).map((entry) => entry.itemId);
}

export function resolveCombatRewards(input: RewardsInput): CombatRewards {
  const xp = xpOutcome(input);
  const chance = input.hero.stats.chance;
  const prospection = computeProspection({ basePp: input.hero.pp, chance });
  const drops = rollDrops(input.monster.loot, prospection, input.rng);
  return { ...xp, levelUp: levelUpFor(input, xp.level), prospection, drops };
}
