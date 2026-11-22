import type { ClassDef, StatKey } from "../../schemas/classSchema";
import type { Hero } from "../createHero";
import type { SpendStatPointsResult } from "../spendStatPoints";
import { spendStatPoints } from "../spendStatPoints";

export interface SpendCapitalPointsInput {
  hero: Hero;
  stat: StatKey;
  points: number;
  classDef: ClassDef;
}

export interface SpendCapitalPointsOutput {
  hero: Hero;
  result: SpendStatPointsResult;
}

function gainPerPoint(stat: StatKey, classDef: ClassDef): number | undefined {
  return stat === "vitality" ? classDef.vitalityGainPerPoint : undefined;
}

function setStat(hero: Hero, stat: StatKey, value: number): Hero {
  const next = { ...hero };
  next[stat] = value;
  return next;
}

function refusal(hero: Hero, stat: StatKey): SpendCapitalPointsOutput {
  const value = hero[stat];
  return { hero, result: { gained: 0, spent: 0, remaining: hero.capitalPoints, value } };
}

/**
 * Dépense des points de capital dans UNE caractéristique.
 * Vitalité : +1 PV maximum par point (via la projection du combattant, D45a).
 * PA et PM ne bougent jamais ici.
 */
export function spendCapitalPoints(input: SpendCapitalPointsInput): SpendCapitalPointsOutput {
  const { hero, stat, points, classDef } = input;
  if (points <= 0 || points > hero.capitalPoints) return refusal(hero, stat);
  const options = { stat, current: hero[stat], availablePoints: points, softCaps: classDef.softCaps };
  const result = spendStatPoints({ ...options, gainPerPoint: gainPerPoint(stat, classDef) });
  const spent = setStat(hero, stat, result.value);
  return { hero: { ...spent, capitalPoints: hero.capitalPoints - result.spent }, result };
}
