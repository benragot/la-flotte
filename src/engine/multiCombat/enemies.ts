import type { Position } from "../grid";
import { samePosition } from "../grid";
import { resolveAttack } from "./attack";
import { isAlive, isAliveById, withCombatant } from "./combatants";
import { activeCombatant } from "./timeline";
import type { BattleState, CombatantLike, EnemyAction, EnemyStrategy, Rng } from "./types";

/** Garde-fou anti-boucle : un tour ennemi ne dépasse jamais 10 actions. */
const MAX_ACTIONS_PER_TURN = 10;

export interface EnemiesActInput {
  state: BattleState;
  rng: Rng;
  strategy: EnemyStrategy;
}

interface StepContext {
  input: EnemiesActInput;
  current: BattleState;
  enemy: CombatantLike;
  action: EnemyAction;
}

interface StepResult {
  state: BattleState;
  stop: boolean;
}

function moveEnemy(current: BattleState, enemy: CombatantLike, to: Position): BattleState {
  if (samePosition(enemy.position, to)) return current;
  return withCombatant(current, { ...enemy, position: to });
}

function applyAction(context: StepContext): BattleState {
  const { action, current, enemy, input } = context;
  if (action.kind === "move") return moveEnemy(current, enemy, action.to);
  const targetId = action.targetId;
  const attack = action.attack;
  return resolveAttack({ state: current, attackerId: enemy.id, targetId, attack, rng: input.rng });
}

function targetDied(next: BattleState, action: EnemyAction): boolean {
  return action.kind === "attack" && !isAliveById(next, action.targetId);
}

function shouldStop(previous: BattleState, next: BattleState, action: EnemyAction): boolean {
  if (next === previous) return true;
  return targetDied(next, action);
}

/** Ennemi actif et vivant, `null` sinon (la timeline conserve les morts). */
function activeEnemy(state: BattleState): CombatantLike | null {
  const active = activeCombatant(state);
  if (active === null || !isAlive(active) || active.side !== "enemy") return null;
  return active;
}

function stepOnce(input: EnemiesActInput, current: BattleState): StepResult {
  const enemy = activeEnemy(current);
  if (enemy === null) return { state: current, stop: true };
  const action = input.strategy(current, enemy.id);
  if (action === null) return { state: current, stop: true };
  const state = applyAction({ input, current, enemy, action });
  return { state, stop: shouldStop(current, state, action) };
}

function runLoop(input: EnemiesActInput, current: BattleState, steps: number): BattleState {
  if (steps >= MAX_ACTIONS_PER_TURN) return current;
  const result = stepOnce(input, current);
  if (result.stop) return result.state;
  return runLoop(input, result.state, steps + 1);
}

/**
 * Joue UN tour ennemi avec une stratégie injectée `(state, enemyId)`.
 * La boucle s'arrête sur `null`, quand la cible meurt, quand l'état ne change
 * plus (comparaison de référence) et au plus tard après 10 actions : aucune
 * stratégie ne peut boucler indéfiniment.
 */
export function enemiesAct(input: EnemiesActInput): BattleState {
  return runLoop(input, input.state, 0);
}
