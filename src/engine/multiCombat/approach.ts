import type { Position } from "../grid";
import { findPath, mapPathBudget, neighborCells, pathCost, pathWithinBudget, samePosition } from "../grid";
import { manhattan } from "../combatLoop/cells";
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

function pathTo(input: ApproachInput, to: Position, extraBlocked: readonly Position[] = []): Position[] | null {
  const map = input.state.map;
  if (map === undefined) return null;
  const occupied = [...blockers(input.state, input.enemy.id, input.target.id), ...extraBlocked];
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

/** Une case de contact doit être libre : ni l'ennemi, ni la cible, ni un tiers vivant. */
function freeContactCells(input: ApproachInput): Position[] {
  const taken = [input.enemy.position, input.target.position, ...blockers(input.state, input.enemy.id, input.target.id)];
  return neighborCells(input.target.position).filter((cell) => !taken.some((takenCell) => samePosition(takenCell, cell)));
}

/** Pour une case de contact, la cible elle-même bloque : on ne la traverse pas. */
function contactPathTo(input: ApproachInput, to: Position): Position[] | null {
  return pathTo(input, to, [input.target.position]);
}

/**
 * Le contact ne fait que se resserrer : seule une case qui **baisse** la distance
 * de Manhattan (la métrique de portée, cf. `rangeOf`) est une approche. Sans ce
 * garde, un monstre déjà adjacent orthogonalement se décalerait latéralement.
 */
function tighterContact(input: ApproachInput, cell: Position): boolean {
  return manhattan(cell, input.target.position) < manhattan(input.enemy.position, input.target.position);
}

/** Dernière case payée d'un chemin de contact : au moins le départ et un pas. */
function paidLanding(path: Position[] | null, cells: number): Position | null {
  if (path === null) return null;
  const paid = pathWithinBudget(path, cells);
  return paid.length < 2 ? null : (paid.at(-1) ?? null);
}

/** Repli : la cible occupe sa propre case, on vise la meilleure case **libre** au contact. */
function contactLanding(input: ApproachInput): Position | null {
  const paths = freeContactCells(input).map((cell) => contactPathTo(input, cell)).filter(isPath);
  const cell = paidLanding(cheapest(paths), input.cells);
  return cell !== null && tighterContact(input, cell) ? cell : null;
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
