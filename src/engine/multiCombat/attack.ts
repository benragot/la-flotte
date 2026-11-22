import { findCombatant, isActive, isAlive } from "./combatants";
import { rollsCritical } from "./crit";
import { resolveHit, spendAp } from "./strike";
import type { DamageContext } from "./strike";
import type { AttackSpec, BattleState, CombatantLike, Rng } from "./types";

export interface AttackInput {
  state: BattleState;
  attackerId: string;
  targetId: string;
  attack: AttackSpec;
  rng: Rng;
}

function participants(input: AttackInput): [CombatantLike, CombatantLike] | null {
  const attacker = findCombatant(input.state, input.attackerId);
  const target = findCombatant(input.state, input.targetId);
  if (attacker === undefined || target === undefined) return null;
  return [attacker, target];
}

/** L'entité doit être celle du tour ET en vie (la timeline conserve les morts). */
function hasBudget(input: AttackInput, attacker: CombatantLike): boolean {
  return isActive(input.state, input.attackerId) && isAlive(attacker);
}

function isTargetStrikable(input: AttackInput, attacker: CombatantLike, target: CombatantLike): boolean {
  return isAlive(target) && input.attack.apCost <= attacker.ap;
}

/** Refus : auto-ciblage, actif mort ou hors tour, cible morte, PA insuffisants. */
function canStrike(input: AttackInput, attacker: CombatantLike, target: CombatantLike): boolean {
  if (input.targetId === input.attackerId) return false;
  if (!hasBudget(input, attacker)) return false;
  return isTargetStrikable(input, attacker, target);
}

function hitContext(input: AttackInput, attacker: CombatantLike, target: CombatantLike): DamageContext {
  const critical = rollsCritical(attacker, input.attack, input.rng);
  const critDamagePct = input.attack.critDamagePct ?? 0;
  return { state: input.state, attacker, target, attack: input.attack, critical, critDamagePct };
}

/**
 * Résout un coup 1vN. Refus par identité (état renvoyé tel quel) : auto-ciblage,
 * attaquant non actif ou mort, cible morte, PA insuffisants.
 *
 * Aucune vérification de **portée ni de ligne de vue** : c'est la charge de
 * l'appelant (équivalent de `getCastableCells` en 1v1). Dégâts via
 * `computeDamage` (résistances de la cible), poussée via `applyPush` +
 * `computePushbackDamage`.
 */
export function resolveAttack(input: AttackInput): BattleState {
  const pair = participants(input);
  if (pair === null || !canStrike(input, pair[0], pair[1])) return input.state;
  const context = hitContext(input, pair[0], pair[1]);
  const paid = spendAp(input.state, pair[0], input.attack.apCost);
  return resolveHit({ ...context, state: paid });
}
