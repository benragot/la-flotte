import type { Position } from "../grid";
import { findPath } from "../grid";
import type { BattleState, CombatantLike } from "./types";

/**
 * Approche ennemie (5C-e). Le chemin vient de `grid/findPath`, la seule
 * convention de déplacement du projet (celle de `combatLoop/move.ts` et
 * `exploration/move.ts`) : quatre voisins praticables, pas de diagonale, pas de
 * mur, pas de case occupée.
 */
export interface ApproachInput {
  state: BattleState;
  enemy: CombatantLike;
  target: CombatantLike;
  /** PM restants de l'ennemi. */
  cells: number;
}

/** Les autres vivants bloquent le passage ; la cible est exclue (elle est l'arrivée). */
function blockers(state: BattleState, enemyId: string, targetId: string): Position[] {
  const others = state.combatants.filter((entry) => entry.hp > 0 && entry.id !== enemyId && entry.id !== targetId);
  return others.map((entry) => entry.position);
}

/**
 * `findPath` rend le chemin complet, case de départ incluse, et la cible occupe
 * la dernière : la dernière case où l'on peut s'arrêter est donc `length - 2`.
 */
function landing(path: readonly Position[], cells: number): Position | null {
  const steps = Math.min(cells, path.length - 2);
  if (steps <= 0) return null;
  return path[steps] ?? null;
}

/** Case d'arrivée vers la cible, `null` si aucun pas n'est possible (mur, PM, blocage). */
export function approachCell(input: ApproachInput): Position | null {
  const map = input.state.map;
  if (map === undefined || input.cells <= 0) return null;
  const occupied = blockers(input.state, input.enemy.id, input.target.id);
  const from = input.enemy.position;
  const path = findPath({ map, from, to: input.target.position, maxPm: map.width * map.height, occupied });
  return path === null ? null : landing(path, input.cells);
}
