import type { ApRule, LevelUpGain, XpTier } from "../economy";
import { computeLevelFromXp } from "../economy";
import type { Hero } from "../createHero";
import { applyLevelUp } from "./applyLevelUp";

export interface GainXpInput {
  hero: Hero;
  amount: number;
  tiers: readonly XpTier[];
  apRules: readonly ApRule[];
  gainRules: LevelUpGain;
}

export interface GainXpOutput {
  hero: Hero;
  levelsGained: number;
}

function levelUpFor(input: GainXpInput, xp: number) {
  const targetLevel = computeLevelFromXp(xp, input.tiers);
  const options = { targetLevel, gainRules: input.gainRules, apRules: input.apRules };
  return applyLevelUp({ hero: input.hero, ...options });
}

/** Ajoute l'XP et applique les montées de niveau ; gain nul ⇒ même référence. */
export function gainXp(input: GainXpInput): GainXpOutput {
  if (input.amount <= 0) return { hero: input.hero, levelsGained: 0 };
  const xp = input.hero.xp + input.amount;
  const { hero, applied } = levelUpFor(input, xp);
  return { hero: { ...hero, xp }, levelsGained: applied.length };
}
