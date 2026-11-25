import type { LootEntry, MonsterDef } from "../../schemas/monsterSchema";
import type { ProgressionDef } from "../../schemas/progressionSchema";
import type { CombatXpInput, LevelUpGain } from "../economy";
import {
  computeCombatXp,
  computeDropChance,
  computeLevelFromXp,
  computeProspection,
  getStatsGainForLevelUp,
} from "../economy";
import type { CombatRewards, CombatantState, Rng } from "./types";

/** Confort dev (jamais lu depuis l'environnement ici) : défaut neutre ×1. */
export interface RewardsMultipliers {
  xp?: number;
  drop?: number;
}

export interface RewardsInput {
  heroXp: number;
  hero: CombatantState;
  monster: MonsterDef;
  progression: ProgressionDef;
  rng: Rng;
  multipliers?: RewardsMultipliers;
}

interface XpOutcome {
  xpGained: number;
  totalXp: number;
  level: number;
}

/**
 * Règles d'XP lues au YAML. `H` (niveau du plus gros monstre) vaut `M` ici :
 * ce chemin ne résout que le 1v1 ; le 1vN (ΣM, max M) n'est pas traité.
 */
function xpInput(input: RewardsInput): CombatXpInput {
  const { baseXp: baseMonsterXp, level: monsterLevel } = input.monster;
  const wisdom = input.hero.stats.wisdom;
  const base = { baseMonsterXp, monsterLevel, wisdom };
  return { ...base, playerLevel: input.hero.level, ...input.progression.experience };
}

function xpOutcome(input: RewardsInput): XpOutcome {
  const multiplier = input.multipliers?.xp ?? 1;
  const xpGained = Math.floor(computeCombatXp(xpInput(input)) * multiplier);
  const totalXp = input.heroXp + xpGained;
  return { xpGained, totalXp, level: computeLevelFromXp(totalXp, input.progression.xpThresholds) };
}

function levelUpFor(input: RewardsInput, level: number): LevelUpGain | null {
  if (level <= input.hero.level) return null;
  return getStatsGainForLevelUp(level, input.progression.gainRules);
}

interface DropRoll {
  loot: readonly LootEntry[];
  prospection: number;
  rng: Rng;
  dropMultiplier: number;
}

function dropRoll(input: RewardsInput, prospection: number): DropRoll {
  const dropMultiplier = input.multipliers?.drop ?? 1;
  return { loot: input.monster.loot, prospection, rng: input.rng, dropMultiplier };
}

/** Un tirage `rng()` par entrée de butin, dans l'ordre du YAML. */
function dropChanceFor(entry: LootEntry, roll: DropRoll): number {
  const baseDropRate = entry.baseDropRate;
  const chance = computeDropChance({ playerPp: roll.prospection, ppThreshold: entry.ppThreshold, baseDropRate });
  return Math.min(1, chance * roll.dropMultiplier);
}

function rollDrops(roll: DropRoll): string[] {
  const dropped = roll.loot.filter((entry) => roll.rng() < dropChanceFor(entry, roll));
  return dropped.map((entry) => entry.itemId);
}

export function resolveCombatRewards(input: RewardsInput): CombatRewards {
  const xp = xpOutcome(input);
  const chance = input.hero.stats.chance;
  const prospection = computeProspection({ basePp: input.hero.pp, chance });
  const drops = rollDrops(dropRoll(input, prospection));
  return { ...xp, levelUp: levelUpFor(input, xp.level), prospection, drops };
}
