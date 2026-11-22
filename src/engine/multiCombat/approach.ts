import type { Position } from "../grid";
import { findPath, mapPathBudget, neighborCells, pathCost, pathWithinBudget } from "../grid";
import type { BattleState, CombatantLike } from "./types";

/**
 * Approche ennemie (5C-e). Le chemin vient de `grid/findPath`, la seule
 * convention de déplacement du projet (celle de `combatLoop/move.ts` et
 * `exploration/move.ts`) : **huit voisins praticables**, **1 PM orthogonal et
 * 2 PM diagonal** (DEC-10), **coin coupé interdit quand ses deux orthogonaux
 * sont bloqués**, jamais un mur `#`, jamais de l'eau `~`, jamais une case occupée.
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

function pathTo(input: ApproachInput, to: Position): Position[] | null {
  const map = input.state.map;
  if (map === undefined) return null;
  const occupied = blockers(input.state, input.enemy.id, input.target.id);
  return findPath({ map, from: input.enemy.position, to, maxPm: mapPathBudget(map), occupied });
}

function isPath(path: Position[] | null): path is Position[] {
  return path !== null;
}

function cheapest(paths: readonly Position[][]): Position[] | null {
  const better = (chosen: Position[] | null, path: Position[]) =>
    chosen === null || pathCost(path) < pathCost(chosen) ? path : chosen;
  return paths.reduce<Position[] | null>(better, null);
}

/** Plus long préfixe payable qui s'arrête **avant** la case de la cible. */
function landing(path: readonly Position[], cells: number): Position | null {
  const paid = pathWithinBudget(path.slice(0, -1), cells);
  return paid.length < 2 ? null : (paid.at(-1) ?? null);
}

/** Repli : la cible occupe sa propre case, on vise la meilleure case au contact. */
function contactLanding(input: ApproachInput): Position | null {
  const paths = neighborCells(input.target.position).map((cell) => pathTo(input, cell)).filter(isPath);
  const path = cheapest(paths);
  const paid = path === null ? [] : pathWithinBudget(path, input.cells);
  return paid.length < 2 ? null : (paid.at(-1) ?? null);
}

function isBlocked(input: ApproachInput): boolean {
  return input.state.map === undefined || input.cells <= 0;
}

/** Case d'arrivée vers la cible, `null` si aucun pas n'est possible (mur, PM, blocage). */
export function approachCell(input: ApproachInput): Position | null {
  if (isBlocked(input)) return null;
  const path = pathTo(input, input.target.position);
  return path === null ? null : (landing(path, input.cells) ?? contactLanding(input));
}
