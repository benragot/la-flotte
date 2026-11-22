import type { Element } from "../../schemas/spellSchema";
import type { CombatStats, CombatantState, CombatResistances } from "../combatLoop/types";
import type { Hero } from "../createHero";
import { computeProspection } from "../economy";
import type { Position } from "../grid";
import type { TotalStats } from "../inventory";

export interface HeroCombatantInput {
  hero: Hero;
  stats: TotalStats;
  position: Position;
  spellIds: string[];
}

const NO_ELEMENT_RES: Record<Element, number> = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };

function zeroResistances(): CombatResistances {
  return { flat: { ...NO_ELEMENT_RES }, percent: { ...NO_ELEMENT_RES } };
}

function hpPool(hero: Hero, stats: TotalStats) {
  const maxHp = hero.maxHp + stats.hp;
  return { hp: Math.min(hero.hp, maxHp), maxHp };
}

function apPool(hero: Hero, stats: TotalStats) {
  const ap = hero.ap + stats.ap;
  return { ap, maxAp: ap };
}

function mpPool(hero: Hero, stats: TotalStats) {
  const mp = hero.mp + stats.mp;
  return { mp, maxMp: mp };
}

function combatPp(hero: Hero, stats: TotalStats): number {
  return computeProspection({ basePp: hero.pp, chance: stats.chance, bonusPp: stats.prospection });
}

function combatStats(stats: TotalStats): CombatStats {
  const { strength, intelligence, chance, agility, wisdom } = stats;
  return { strength, intelligence, chance, agility, wisdom };
}

/**
 * Projette le héros persistant (équipement et panoplies inclus) vers le
 * combattant attendu par `combatLoop`. Les résistances restent à 0 tant que
 * les objets n'en fournissent pas par élément.
 */
export function combatantFromHero(input: HeroCombatantInput): CombatantState {
  const { hero, stats, position, spellIds } = input;
  const identity = { id: "player", kind: "player" as const, name: hero.name, level: hero.level };
  const pools = { ...hpPool(hero, stats), ...apPool(hero, stats), ...mpPool(hero, stats) };
  const extras = { accuracyPct: 0, pp: combatPp(hero, stats), stats: combatStats(stats) };
  return { ...identity, position, ...pools, ...extras, resistances: zeroResistances(), spellIds };
}
