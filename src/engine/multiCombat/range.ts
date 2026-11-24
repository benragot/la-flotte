import type { Position } from "../grid";
import { hasLineOfSight, rangeDistance } from "../grid";
import type { AttackSpec, BattleState, CombatantLike, RangeSpec } from "./types";

/**
 * Géométrie du 1vN. La distance de portée est **celle du projet** :
 * `rangeDistance` de `grid`, la métrique de Chebyshev utilisée par `castable.ts`
 * pour `minRange`/`maxRange` en 1v1. Ce n'est pas la facture DEC-10 des
 * déplacements. La ligne de vue est **celle de `grid`** (`hasLineOfSight`),
 * jamais réimplémentée : seuls les murs `#` bloquent.
 */
/**
 * Refus géométrique. `too-close` est distinct de `out-of-range` : à distance 0
 * (deux combattants sur la même case, ou sort de contact refusé) le joueur doit
 * lire « trop proche », pas « hors portée ».
 */
export type CastBlock = "too-close" | "out-of-range" | "no-los";

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

function distanceOf(check: RangeCheck): number {
  return rangeDistance(check.attacker.position, check.target.position);
}

function tooClose(check: RangeCheck): boolean {
  return distanceOf(check) < check.range.min;
}

function beyondRange(check: RangeCheck): boolean {
  return distanceOf(check) > check.range.max;
}

/** Sans carte, aucune mesure : le comportement historique reste intact. */
function sightBlocked(state: BattleState, from: Position, to: Position): boolean {
  if (state.map === undefined) return false;
  return !hasLineOfSight({ map: state.map, from, to });
}

function geometricBlock(check: RangeCheck): CastBlock | null {
  if (tooClose(check)) return "too-close";
  if (beyondRange(check)) return "out-of-range";
  return null;
}

function lineOfSightBlock(check: RangeCheck): CastBlock | null {
  if (!check.range.requiresLos) return null;
  const blocked = sightBlocked(check.state, check.attacker.position, check.target.position);
  return blocked ? "no-los" : null;
}

/** Raison du refus géométrique, `null` si le coup est possible. */
export function castBlock(check: RangeCheck): CastBlock | null {
  return geometricBlock(check) ?? lineOfSightBlock(check);
}
