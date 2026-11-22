import { manhattan } from "../combatLoop/cells";
import type { Position } from "../grid";
import { isWalkableCell, samePosition } from "../grid";
import { resolveAttack } from "./attack";
import { appendLog, isAlive, isAliveById, withCombatant } from "./combatants";
import { separateOccupants } from "./overlap";
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

function affordableStep(enemy: CombatantLike, cost: number): boolean {
  return cost > 0 && cost <= enemy.mp;
}

/** Sans carte (combat de test sans grille), aucun mur ne peut s'opposer au pas. */
function walkableStep(current: BattleState, to: Position): boolean {
  return current.map === undefined || isWalkableCell(current.map, to);
}

/** Invariant « aucune case partagée » : la case d'arrivée doit être libre. */
function arrivalTaken(current: BattleState, enemy: CombatantLike, to: Position): boolean {
  const others = current.combatants.filter((entry) => entry.id !== enemy.id && entry.hp > 0);
  return others.some((entry) => samePosition(entry.position, to));
}

/** Un pas coûte une case de PM par case parcourue, comme `combatLoop/move.ts`. */
function moveEnemy(current: BattleState, enemy: CombatantLike, to: Position): BattleState {
  const cost = manhattan(enemy.position, to);
  if (!affordableStep(enemy, cost) || !walkableStep(current, to)) return current;
  if (arrivalTaken(current, enemy, to)) return current;
  const moved = withCombatant(current, { ...enemy, position: to, mp: enemy.mp - cost });
  return appendLog(moved, `${enemy.name} se déplace de ${cost} case(s).`);
}

/** Ni approche ni attaque : le joueur lit la raison au lieu d'un tour vide. */
function blockedStep(current: BattleState, enemy: CombatantLike, reason: string): BattleState {
  return appendLog(current, `${enemy.name} ne peut pas atteindre le héros (${reason}).`);
}

function applyAction(context: StepContext): BattleState {
  const { action, current, enemy, input } = context;
  if (action.kind === "move") return moveEnemy(current, enemy, action.to);
  if (action.kind === "blocked") return blockedStep(current, enemy, action.reason);
  const targetId = action.targetId;
  const attack = action.attack;
  return resolveAttack({ state: current, attackerId: enemy.id, targetId, attack, rng: input.rng });
}

function targetDied(next: BattleState, action: EnemyAction): boolean {
  return action.kind === "attack" && !isAliveById(next, action.targetId);
}

function shouldStop(previous: BattleState, next: BattleState, action: EnemyAction): boolean {
  if (next === previous) return true;
  if (action.kind === "blocked") return true;
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
 * La boucle s'arrête sur `null`, sur un refus (`blocked`), quand la cible meurt,
 * quand l'état ne change plus (comparaison de référence) et au plus tard après
 * 10 actions : aucune stratégie ne peut boucler indéfiniment.
 *
 * Avant la première action, les ennemis qui partagent une case sont dégagés
 * (`separateOccupants`) : un état hérité ne peut plus figer la salle.
 */
export function enemiesAct(input: EnemiesActInput): BattleState {
  return runLoop(input, separateOccupants(input.state), 0);
}
