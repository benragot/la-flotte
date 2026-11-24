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

/** La donnée est globale (`flatRes` / `percentRes`) : chaque élément la reçoit. */
function perElement(value: number): Record<Element, number> {
  return { earth: value, fire: value, water: value, air: value, neutral: value };
}

function itemResistances(stats: TotalStats): CombatResistances {
  return { flat: perElement(stats.flatRes), percent: perElement(stats.percentRes) };
}

/** Bonus de PV porté par l'équipement et la Vitalité : commun aux deux domaines. */
function hpBonus(stats: TotalStats): number {
  return stats.hp + stats.vitality;
}

/**
 * Projection additive : les PV persistés (domaine de niveau) reçoivent le bonus
 * d'objets et de Vitalité, bornés au maximum effectif. Aucune sentinelle
 * d'égalité : un héros blessé reste blessé, un héros plein reste plein.
 */
function hpPool(hero: Hero, stats: TotalStats) {
  const maxHp = hero.maxHp + hpBonus(stats);
  return { hp: Math.min(hero.hp + hpBonus(stats), maxHp), maxHp };
}

/**
 * Retour vers le domaine de niveau, celui que `saveSchema` persiste : on retire
 * le bonus d'objets/Vitalité sans jamais soigner ni dépasser `hero.maxHp`.
 * Un héros encore vivant en combat garde **au moins 1 PV** : sans ce plancher,
 * 10 PV effectifs face à un bonus de 200 devenaient 0, donc un héros mort à la
 * sortie d'une salle (constaté en gagnant le donjon).
 */
export function heroHpFromCombat(hp: number, hero: Hero, stats: TotalStats): number {
  const floor = hp > 0 ? 1 : 0;
  return Math.max(floor, Math.min(hp - hpBonus(stats), hero.maxHp));
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
 * combattant attendu par `combatLoop` : résistances fixes et pourcentages par
 * élément, `% Dégâts` et stats. La donnée ne distingue pas les éléments, donc
 * `flatRes`/`percentRes` s'appliquent aux cinq.
 */
export function combatantFromHero(input: HeroCombatantInput): CombatantState {
  const { hero, stats, position, spellIds } = input;
  const identity = { id: "player", kind: "player" as const, name: hero.name, level: hero.level };
  const pools = { ...hpPool(hero, stats), ...apPool(hero, stats), ...mpPool(hero, stats) };
  const extras = { accuracyPct: 0, pp: combatPp(hero, stats), stats: combatStats(stats) };
  const damage = { percentDmg: stats.percentDmg, resistances: itemResistances(stats) };
  return { ...identity, position, ...pools, ...extras, ...damage, spellIds };
}
