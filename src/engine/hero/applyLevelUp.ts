import type { ApRule, LevelUpGain } from "../economy";
import { getBaseApForLevel } from "../economy";
import type { Hero } from "../createHero";

export interface ApplyLevelUpInput {
  hero: Hero;
  targetLevel: number;
  gainRules: LevelUpGain;
  apRules: readonly ApRule[];
}

export interface ApplyLevelUpOutput {
  hero: Hero;
  applied: LevelUpGain[];
}

interface LeveledState {
  hero: Hero;
  targetLevel: number;
  gain: LevelUpGain;
  apRules: readonly ApRule[];
}

function gainsFor(levels: number, gainRules: LevelUpGain): LevelUpGain[] {
  return Array.from({ length: levels }, () => ({ ...gainRules }));
}

function totalGain(levels: number, gainRules: LevelUpGain): LevelUpGain {
  return {
    hp: gainRules.hp * levels,
    capitalPoints: gainRules.capitalPoints * levels,
    spellPoints: gainRules.spellPoints * levels,
  };
}

function addHp(hero: Hero, hp: number): Hero {
  return { ...hero, hp: hero.hp + hp, maxHp: hero.maxHp + hp };
}

function addPoints(hero: Hero, gain: LevelUpGain): Hero {
  return {
    ...hero,
    capitalPoints: hero.capitalPoints + gain.capitalPoints,
    spellPoints: hero.spellPoints + gain.spellPoints,
  };
}

function leveledHero(state: LeveledState): Hero {
  const withHp = addHp(state.hero, state.gain.hp);
  const withPoints = addPoints(withHp, state.gain);
  return { ...withPoints, level: state.targetLevel, ap: getBaseApForLevel(state.targetLevel, state.apRules) };
}

/** Applique les gains niveau par niveau, sans jamais dépasser `targetLevel`. */
export function applyLevelUp(input: ApplyLevelUpInput): ApplyLevelUpOutput {
  const { hero, targetLevel, gainRules, apRules } = input;
  const levels = targetLevel - hero.level;
  if (levels <= 0) return { hero, applied: [] };
  const gain = totalGain(levels, gainRules);
  const leveled = leveledHero({ hero, targetLevel, gain, apRules });
  return { hero: leveled, applied: gainsFor(levels, gainRules) };
}
