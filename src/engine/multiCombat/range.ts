import { manhattan } from "../combatLoop/cells";
import type { Position } from "../grid";
import { hasLineOfSight } from "../grid";
import type { AttackSpec, BattleState, CombatantLike, RangeSpec } from "./types";

/**
 * Géométrie du 1vN. La distance de portée est **celle du projet** :
 * `manhattan` de `combatLoop/cells`, celle qu'utilise `castable.ts` pour
 * `minRange`/`maxRange` en 1v1. La ligne de vue est **celle de `grid`**
 * (`hasLineOfSight`), jamais réimplémentée : seuls les murs `#` bloquent.
 */
export type CastBlock = "out-of-range" | "no-los";

export interface RangeCheck {
  state: BattleState;
  attacker: CombatantLike;
  target: CombatantLike;
  range: RangeSpec;
}

/** Portée déclarée par une attaque ; `undefined` = aucune contrainte (comportement 5C-c). */
export function rangeOf(attack: AttackSpec): RangeSpec | undefined {
  const { minRange, maxRange } = attack;
  if (minRange === undefined || maxRange === undefined) return undefined;
  return { min: minRange, max: maxRange, requiresLos: attack.requiresLos ?? false };
}

function outOfRange(check: RangeCheck): boolean {
  const distance = manhattan(check.attacker.position, check.target.position);
  return distance < check.range.min || distance > check.range.max;
}

/** Sans carte, aucune mesure : le comportement historique reste intact. */
function sightBlocked(state: BattleState, from: Position, to: Position): boolean {
  if (state.map === undefined) return false;
  return !hasLineOfSight({ map: state.map, from, to });
}

/** Raison du refus géométrique, `null` si le coup est possible. */
export function castBlock(check: RangeCheck): CastBlock | null {
  if (outOfRange(check)) return "out-of-range";
  if (!check.range.requiresLos) return null;
  return sightBlocked(check.state, check.attacker.position, check.target.position) ? "no-los" : null;
}
