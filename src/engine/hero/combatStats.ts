import type { Hero } from "../createHero";

export interface HeroCombatStats {
  strength: number;
  intelligence: number;
  chance: number;
  agility: number;
  wisdom: number;
}

/** Projette les caractéristiques persistantes du héros vers `CombatantState.stats`. */
export function heroCombatStats(hero: Hero): HeroCombatStats {
  const { strength, intelligence, chance, agility, wisdom } = hero;
  return { strength, intelligence, chance, agility, wisdom };
}
