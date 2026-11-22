import type { DamageInput } from "../engine/combat";
import { computeCritRate, computeDamage, computePushbackDamage } from "../engine/combat";
import type { Element } from "../schemas/spellSchema";

export interface AttackerStats {
  strength: number;
  intelligence: number;
  chance: number;
  agility: number;
}

export interface ElementResistances {
  flat: Record<Element, number>;
  percent: Record<Element, number>;
}

export interface DamagePreviewInput {
  spell: { base: { min: number; max: number }; element: Element };
  attackerStats: AttackerStats;
  /** Résistances **de la cible** : elles sont lues côté cible, comme dans le combat. */
  target: {
    resistances: ElementResistances;
    /** Armure plate, cumulée aux résistances fixes par `computeDamage` (cf. `CombatantLike.armor`). */
    armor?: number;
  };
  casterLevel: number;
  /** Cases de poussée ; 0 ou absent = pas de poussée. */
  pushCells?: number;
  /** La cible est un joueur : plafonne sa résistance % à 50 (règle 1.29). */
  isTargetPlayer?: boolean;
  /** Critère de CC du sort, purement transmis à `computeCritRate`. */
  baseCrit?: number;
  bonusCrit?: number;
  /** Bonus de dégâts (%) du coup critique, appliqué via `percentDmg`. */
  critDamagePct?: number;
}

export interface DamagePreview {
  min: number;
  max: number;
  /** Dégâts avec un jet maximal et le bonus de critique éventuel. */
  critical: number;
  /** Dégâts de collision, 0 sans poussée. */
  pushDamage: number;
  /** Taux de coup critique en pourcentage, tel que fourni par le moteur. */
  critRate: number;
}

/** Dé de poussée retenu pour l'aperçu : fourchette haute, « au mieux ». */
const BEST_PUSHBACK_ROLL = 8;

// TODO 5B : mutualiser avec multiCombat/strike.ts et combatLoop/cast.ts.
const ELEMENT_STAT: Record<Element, keyof AttackerStats> = {
  earth: "strength",
  fire: "intelligence",
  water: "chance",
  air: "agility",
  neutral: "strength",
};

export function elementStat(input: { element: Element; stats: AttackerStats }): number {
  return input.stats[ELEMENT_STAT[input.element]];
}

interface DamageShape {
  input: DamagePreviewInput;
  base: number;
  percentDmg: number;
}

function resistanceFields(
  input: DamagePreviewInput,
  element: Element,
): Pick<DamageInput, "flatRes" | "pctRes" | "armor"> {
  const { resistances, armor } = input.target;
  return { flatRes: resistances.flat[element], pctRes: resistances.percent[element], armor };
}

function statOf(input: DamagePreviewInput, element: Element): number {
  return elementStat({ element, stats: input.attackerStats });
}

function damageInput(shape: DamageShape): DamageInput {
  const element = shape.input.spell.element;
  return {
    base: shape.base,
    stat: statOf(shape.input, element),
    percentDmg: shape.percentDmg,
    ...resistanceFields(shape.input, element),
    isPlayer: shape.input.isTargetPlayer === true,
  };
}

function rollDamage(input: DamagePreviewInput, base: number, percentDmg: number): number {
  return computeDamage(damageInput({ input, base, percentDmg }));
}

function damageRange(input: DamagePreviewInput): { min: number; max: number; critical: number } {
  const { min, max } = input.spell.base;
  return {
    min: rollDamage(input, min, 0),
    max: rollDamage(input, max, 0),
    critical: rollDamage(input, max, input.critDamagePct ?? 0),
  };
}

function pushDamageOf(input: DamagePreviewInput): number {
  const cells = input.pushCells ?? 0;
  if (cells <= 0) return 0;
  const casterLevel = input.casterLevel;
  return computePushbackDamage({ casterLevel, roll: BEST_PUSHBACK_ROLL, remainingCells: cells, isSecondaryTarget: false });
}

function critRateOf(input: DamagePreviewInput): number {
  return computeCritRate({
    baseCrit: input.baseCrit ?? 0,
    bonusCrit: input.bonusCrit ?? 0,
    agility: input.attackerStats.agility,
  });
}

/**
 * Fourchette de dégâts : délègue intégralement à `computeDamage`, `computeCritRate`
 * et `computePushbackDamage` (aucune formule recopiée).
 *
 * `critDamagePct` est une **convention maison** héritée de
 * `multiCombat/strike.ts`, **hors 1.29** (où le CC prend le jet max).
 * Défaut 0 = comportement 1.29. Dette à figer dans une fiche Spec (cible 5B).
 */
export function buildDamagePreview(input: DamagePreviewInput): DamagePreview {
  return { ...damageRange(input), pushDamage: pushDamageOf(input), critRate: critRateOf(input) };
}
