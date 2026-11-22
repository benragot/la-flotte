import { findCombatant, isActive, isAlive } from "./combatants";
import { rollsCritical } from "./crit";
import { applyHit, damageOf, pushDamageOf, spendAp } from "./strike";
import type { DamageContext } from "./strike";
import type { AttackSpec, BattleState, CombatantLike, Rng } from "./types";

export interface AttackInput {
  state: BattleState;
  attackerId: string;
  targetId: string;
  attack: AttackSpec;
  rng: Rng;
  /** Bonus de dégâts (%) ajouté en cas de critique (défaut 0). */
  critDamagePct?: number;
}

function participants(input: AttackInput): [CombatantLike, CombatantLike] | null {
  const attacker = findCombatant(input.state, input.attackerId);
  const target = findCombatant(input.state, input.targetId);
  if (attacker === undefined || target === undefined) return null;
  return [attacker, target];
}

/** Tour, survie de la cible et PA suffisants : les trois refus du coup. */
function canStrike(input: AttackInput, attacker: CombatantLike, target: CombatantLike): boolean {
  if (!isActive(input.state, input.attackerId)) return false;
  if (!isAlive(target)) return false;
  return input.attack.apCost <= attacker.ap;
}

function hitContext(input: AttackInput, attacker: CombatantLike, target: CombatantLike): DamageContext {
  const critical = rollsCritical(attacker, input.attack, input.rng);
  const critDamagePct = input.critDamagePct ?? 0;
  return { state: input.state, attacker, target, attack: input.attack, critical, critDamagePct };
}

/**
 * Résout un coup 1vN : refus par identité (état renvoyé tel quel) si
 * l'attaquant n'est pas actif, si la cible est morte ou si les PA manquent.
 * Dégâts via `computeDamage`, collision via `computePushbackDamage`.
 */
export function resolveAttack(input: AttackInput): BattleState {
  const pair = participants(input);
  if (pair === null || !canStrike(input, pair[0], pair[1])) return input.state;
  const context = hitContext(input, pair[0], pair[1]);
  const paid = spendAp(input.state, pair[0], input.attack.apCost);
  const damage = damageOf(context);
  return applyHit({ ...context, state: paid }, damage, pushDamageOf(context));
}
