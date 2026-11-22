import type { Hero } from "../createHero";
import { computeTotalStats } from "../inventory";
import type { InventoryState, ItemLike, SetLike, StatBlock, TotalStats } from "../inventory";

export interface HeroTotalStatsInput {
  hero: Hero;
  inventory: InventoryState;
  items: readonly ItemLike[];
  sets: readonly SetLike[];
}

function heroBase(hero: Hero): StatBlock {
  const { vitality, wisdom, strength, intelligence, chance, agility } = hero;
  return { vitality, wisdom, strength, intelligence, chance, agility };
}

/**
 * Statistiques totales du héros : caractéristiques persistantes (les points de
 * capital y sont déjà investis) + équipement + bonus de panoplie. `capital`
 * reste vide pour ne jamais compter deux fois les mêmes points.
 */
export function totalStatsFor(input: HeroTotalStatsInput): TotalStats {
  const { hero, inventory, items, sets } = input;
  return computeTotalStats({ base: heroBase(hero), capital: {}, inventory, items, sets });
}
