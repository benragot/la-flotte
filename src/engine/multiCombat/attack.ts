import { findCombatant, isActive, isAlive } from "./combatants";
import { rollsCritical } from "./crit";
import { castBlock, rangeOf } from "./range";
import { isAttackAvailable, recordAttack } from "./spellUse";
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

/** Géométrie : ignorée si l'attaque ne déclare pas de portée ou si la carte manque. */
function reachable(input: AttackInput, pair: [CombatantLike, CombatantLike]): boolean {
  const range = rangeOf(input.attack);
  if (range === undefined || input.state.map === undefined) return true;
  const check = { state: input.state, attacker: pair[0], target: pair[1], range };
  return castBlock(check) === null;
}

/** Quota du sort (`castsPerTurn`, `castsPerTarget`, `cooldown`) sur la cible visée. */
function withinQuota(input: AttackInput, pair: [CombatantLike, CombatantLike]): boolean {
  const { state, attack } = input;
  return isAttackAvailable({ state, casterId: pair[0].id, attack, targetId: pair[1].id });
}

/** Tous les refus qui précèdent le jet : budget, géométrie, quota du sort. */
function isStrikeAllowed(input: AttackInput, pair: [CombatantLike, CombatantLike]): boolean {
  return canStrike(input, pair[0], pair[1]) && reachable(input, pair) && withinQuota(input, pair);
}

/** Jet non critique : la fourchette est tirée **après** la décision de CC. */
function rolledBase(attack: AttackSpec, rng: Rng): number {
  if (attack.damage === undefined) return attack.base;
  const { min, max } = attack.damage;
  return min + Math.floor(rng() * (max - min + 1));
}

/** Le CC prend le jet **maximum** : `critMax` explicite, sinon le haut de la fourchette. */
function criticalBase(attack: AttackSpec): number {
  const crit = attack.critMax;
  if (crit !== undefined) return crit.max;
  const damage = attack.damage;
  if (damage !== undefined) return damage.max;
  return attack.base;
}

function hitContext(input: AttackInput, attacker: CombatantLike, target: CombatantLike): DamageContext {
  const critical = rollsCritical(attacker, input.attack, input.rng);
  const base = critical ? criticalBase(input.attack) : rolledBase(input.attack, input.rng);
  return { state: input.state, attacker, target, attack: { ...input.attack, base }, critical };
}

/**
 * Résout un coup 1vN. Refus par identité (état renvoyé tel quel) : auto-ciblage,
 * attaquant non actif ou mort, cible morte, PA insuffisants, **portée hors
 * bornes** et **ligne de vue bloquée**.
 *
 * La géométrie n'est vérifiée que si l'attaque porte `minRange`/`maxRange` et
 * que `state.map` existe : une attaque nue (`battleAttack`) ou un combat sans
 * carte garde le comportement historique. Un refus ne consomme ni PA ni aléa ;
 * c'est l'appelant qui choisit de journaliser la raison (`castRefusal`).
 * Dégâts via `computeDamage`, poussée via `applyPush` + `computePushbackDamage`.
 */
export function resolveAttack(input: AttackInput): BattleState {
  const pair = participants(input);
  if (pair === null || !isStrikeAllowed(input, pair)) return input.state;
  const context = hitContext(input, pair[0], pair[1]);
  const paid = spendAp(input.state, pair[0], input.attack.apCost);
  const quota = { state: paid, casterId: pair[0].id, attack: input.attack, targetId: pair[1].id };
  return resolveHit({ ...context, state: recordAttack(quota) });
}
