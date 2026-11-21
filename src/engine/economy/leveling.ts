export interface XpTier {
  level: number;
  xpRequired: number;
}

export interface LevelUpGain {
  hp: number;
  capitalPoints: number;
  spellPoints: number;
}

const FIRST_LEVEL = 1;
const AP_BONUS_LEVEL = 100;
const BASE_AP = 6;
const BASE_AP_AT_MAX = 7;
const LEVEL_UP_GAIN: LevelUpGain = { hp: 5, capitalPoints: 5, spellPoints: 1 };
const NO_GAIN: LevelUpGain = { hp: 0, capitalPoints: 0, spellPoints: 0 };

function reachedLevels(xp: number, tiers: readonly XpTier[]): number[] {
  return tiers.filter((tier) => tier.xpRequired <= xp).map((tier) => tier.level);
}

export function computeLevelFromXp(xp: number, tiers: readonly XpTier[]): number {
  const levels = reachedLevels(xp, tiers);
  if (levels.length === 0) return FIRST_LEVEL;
  return Math.max(FIRST_LEVEL, ...levels);
}

export function getStatsGainForLevelUp(level: number): LevelUpGain {
  if (level < FIRST_LEVEL) return NO_GAIN;
  return { ...LEVEL_UP_GAIN };
}

export function getBaseApForLevel(level: number): number {
  return level >= AP_BONUS_LEVEL ? BASE_AP_AT_MAX : BASE_AP;
}
