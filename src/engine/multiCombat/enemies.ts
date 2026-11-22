import type { Position } from "../grid";
import { findPath, mapPathBudget, pathCost, pathWithinBudget, samePosition, stepDistance } from "../grid";
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

/** Facture d'un déplacement : où l'on arrive et ce que l'on paie. */
interface Bill {
  enemy: CombatantLike;
  landing: Position;
  cost: number;
}

function affordableStep(enemy: CombatantLike, cost: number): boolean {
  return cost > 0 && cost <= enemy.mp;
}

/** Vivants autres que `enemy` : ils bloquent le passage comme dans `findPath`. */
function livingOthers(current: BattleState, enemy: CombatantLike): CombatantLike[] {
  return current.combatants.filter((entry) => entry.id !== enemy.id && entry.hp > 0);
}

/** Invariant « aucune case partagée » : la case d'arrivée doit être libre. */
function arrivalTaken(current: BattleState, enemy: CombatantLike, to: Position): boolean {
  return livingOthers(current, enemy).some((entry) => samePosition(entry.position, to));
}

function billMove(current: BattleState, bill: Bill): BattleState {
  const moved = withCombatant(current, { ...bill.enemy, position: bill.landing, mp: bill.enemy.mp - bill.cost });
  return appendLog(moved, `${bill.enemy.name} se déplace de ${bill.cost} case(s).`);
}

/** Chemin réel vers `to`, cases occupées exclues ; `null` si injoignable ou arrivée prise. */
function enemyPath(current: BattleState, enemy: CombatantLike, to: Position): Position[] | null {
  const map = current.map;
  if (map === undefined || arrivalTaken(current, enemy, to)) return null;
  const occupied = livingOthers(current, enemy).map((entry) => entry.position);
  return findPath({ map, from: enemy.position, to, maxPm: mapPathBudget(map), occupied });
}

/**
 * Mappe fournie : la facture est la **somme des pas du chemin réellement
 * trouvé** (DEC-10 : 1 PM orthogonal, 2 PM diagonal), jamais `stepDistance`.
 * Un détour autour d'un mur n'est donc plus offert. Si les PM ne couvrent pas
 * tout le chemin, l'ennemi s'arrête sur la dernière case payée, sans reculer.
 */
function commitMove(current: BattleState, enemy: CombatantLike, path: Position[]): BattleState {
  const paid = pathWithinBudget(path, enemy.mp);
  const landing = paid.at(-1);
  if (paid.length < 2 || landing === undefined) return current;
  return billMove(current, { enemy, landing, cost: pathCost(paid) });
}

/**
 * Sans carte (fixture héritée 5C-c), il n'y a aucun chemin à mesurer : on garde
 * la facture Chebyshev d'origine. Les batailles de production fournissent
 * toujours une carte, donc ce repli ne contourne pas la règle DEC-10.
 */
function legacyMove(current: BattleState, enemy: CombatantLike, to: Position): BattleState {
  const cost = stepDistance(enemy.position, to);
  if (!affordableStep(enemy, cost) || arrivalTaken(current, enemy, to)) return current;
  return billMove(current, { enemy, landing: to, cost });
}

function moveEnemy(current: BattleState, enemy: CombatantLike, to: Position): BattleState {
  if (current.map === undefined) return legacyMove(current, enemy, to);
  const path = enemyPath(current, enemy, to);
  return path === null ? current : commitMove(current, enemy, path);
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
 * (`separateOccupants`) : un état hérité ne fige la salle que si **aucune** case
 * libre n'existe (salle entièrement occupée, inatteignable en pratique).
 */
export function enemiesAct(input: EnemiesActInput): BattleState {
  return runLoop(input, separateOccupants(input.state), 0);
}
