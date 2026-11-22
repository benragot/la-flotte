import type { AsciiMap, Position } from "../grid";
import { isWalkableCell, samePosition } from "../grid";
import { appendLog, withCombatant } from "./combatants";
import type { BattleState, CombatantLike } from "./types";

/**
 * Défense en profondeur de l'invariant « aucune case partagée ».
 *
 * Une sauvegarde ou un état hérité peut déjà contenir deux vivants sur la même
 * case : sans dégagement, le squatter empêche `findPath` de rejoindre le héros
 * (`approachCell` rend `null`) et la salle se fige (D75 : le héros n'a aucune
 * action de déplacement). Au début de chaque tour ennemi, l'**ennemi** qui
 * partage une case rejoint donc la case libre la plus proche — parcours en
 * largeur, ordre haut/droite/bas/gauche, donc déterministe.
 *
 * PORTÉE EXACTE : le gel est levé **dès qu'une case libre existe**. Si la salle
 * est **entièrement occupée** (toutes les cases praticables prises : inatteignable
 * en pratique avec les salles du catalogue), l'ennemi passe son tour et le
 * standoff persiste — cas connu, non traité ici.
 *
 * Le héros n'est jamais déplacé (sa position appartient au joueur) : seul un
 * ennemi squatter peut être relogé.
 */
export interface FreeCellInput {
  map: AsciiMap;
  state: BattleState;
  from: Position;
}

interface Search {
  queue: Position[];
  seen: Set<string>;
}

function cellKey(position: Position): string {
  return `${position.x},${position.y}`;
}

function neighbours(position: Position): Position[] {
  return [
    { x: position.x, y: position.y - 1 },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x - 1, y: position.y },
  ];
}

function livingCells(state: BattleState): Position[] {
  return state.combatants.filter((entry) => entry.hp > 0).map((entry) => entry.position);
}

function freeCell(input: FreeCellInput, cell: Position): boolean {
  if (!isWalkableCell(input.map, cell)) return false;
  return !livingCells(input.state).some((taken) => samePosition(taken, cell));
}

function spread(search: Search, cell: Position): void {
  neighbours(cell).forEach((next) => {
    if (search.seen.has(cellKey(next))) return;
    search.seen.add(cellKey(next));
    search.queue.push(next);
  });
}

function explore(input: FreeCellInput, search: Search): Position | null {
  while (search.queue.length > 0) {
    const cell = search.queue.shift();
    if (cell === undefined) return null;
    if (freeCell(input, cell)) return cell;
    spread(search, cell);
  }
  return null;
}

/** Case praticable et inoccupée la plus proche, `null` si la salle est pleine. */
export function nearestFreeCell(input: FreeCellInput): Position | null {
  const search: Search = { queue: [input.from], seen: new Set<string>([cellKey(input.from)]) };
  return explore(input, search);
}

function sharesCell(state: BattleState, combatant: CombatantLike): boolean {
  const others = state.combatants.filter((entry) => entry.id !== combatant.id && entry.hp > 0);
  return others.some((entry) => samePosition(entry.position, combatant.position));
}

function displace(state: BattleState, map: AsciiMap, enemy: CombatantLike): BattleState {
  const cell = nearestFreeCell({ map, state, from: enemy.position });
  if (cell === null) return state;
  const moved = withCombatant(state, { ...enemy, position: cell });
  return appendLog(moved, `${enemy.name} se dégage de la case occupée.`);
}

function relocate(state: BattleState, map: AsciiMap, enemy: CombatantLike): BattleState {
  return sharesCell(state, enemy) ? displace(state, map, enemy) : state;
}

/** Balayage déterministe des ennemis, dans l'ordre de `state.combatants`. */
interface Sweep {
  map: AsciiMap;
  ids: readonly string[];
  index: number;
}

function livingEnemy(state: BattleState, sweep: Sweep): CombatantLike | undefined {
  const id = sweep.ids[sweep.index];
  return state.combatants.find((entry) => entry.id === id && entry.hp > 0);
}

function relocateAt(state: BattleState, sweep: Sweep): BattleState {
  const enemy = livingEnemy(state, sweep);
  if (enemy === undefined) return state;
  return relocate(state, sweep.map, enemy);
}

function separate(state: BattleState, sweep: Sweep): BattleState {
  if (sweep.index >= sweep.ids.length) return state;
  return separate(relocateAt(state, sweep), { ...sweep, index: sweep.index + 1 });
}

/**
 * Dégage les ennemis vivants qui partagent une case, dans l'ordre de
 * `state.combatants`. État renvoyé **par identité** quand rien ne bouge.
 */
export function separateOccupants(state: BattleState): BattleState {
  const map = state.map;
  if (map === undefined) return state;
  const ids = state.combatants.filter((entry) => entry.side === "enemy").map((entry) => entry.id);
  return separate(state, { map, ids, index: 0 });
}
