import type { AsciiMap, Position } from "../engine/grid";
import { findPath } from "../engine/grid";
import type { CombatState } from "../engine/combatLoop/types";
import type { BattleState } from "../engine/multiCombat";

/**
 * Trajets **réellement parcourus**, tels que le rendu doit les peindre.
 *
 * L'exploration reçoit son chemin du moteur (`exploration/move.ts` le rend puis
 * le store le jetait). Les deux autres moteurs ne rendent pas encore le leur
 * (`combatLoop/move.ts`, `multiCombat/approach.ts`) : le store le redéduit ici
 * avec **le même** `findPath` — huit directions, diagonale à 1 pas, cases
 * occupées exclues. Le rendu, lui, ne calcule plus rien : il consomme.
 */
export interface MovementTrail {
  /** Id du jeton : `player` en exploration et en 1v1, `combatant.id` en salle. */
  id: string;
  /** Cases traversées, départ **et** arrivée inclus. */
  cells: readonly Position[];
}

/** Lot de trajets du dernier changement d'état, avec sa clé de rejeu. */
export interface TrailBatch {
  /** Incrémentée à chaque mouvement : le même trajet rejoué reste un nouveau trajet. */
  version: number;
  trails: readonly MovementTrail[];
}

/** Aucun trajet : l'état d'ouverture et les changements de scène. */
export const NO_TRAILS: TrailBatch = { version: 0, trails: [] };

/** Combattant minimal d'un état : son identité et sa case. */
export interface Mover {
  id: string;
  position: Position;
}

/** Assez grand pour ne jamais borner un chemin déjà validé par le moteur. */
const NO_PM_LIMIT = 999;

function cellKey(position: Position): string {
  return `${position.x}:${position.y}`;
}

/** Les autres combattants bloquent le passage, comme dans `findPath` côté moteur. */
function occupiedBy(before: readonly Mover[], id: string): Position[] {
  return before.filter((mover) => mover.id !== id).map((mover) => mover.position);
}

function movedFrom(before: readonly Mover[], after: Mover): Position | null {
  const previous = before.find((mover) => mover.id === after.id);
  if (previous === undefined) return null;
  return cellKey(previous.position) === cellKey(after.position) ? null : previous.position;
}

function trailFor(map: AsciiMap, before: readonly Mover[], after: Mover): MovementTrail | null {
  const from = movedFrom(before, after);
  if (from === null) return null;
  const input = { map, from, to: after.position, maxPm: NO_PM_LIMIT };
  const cells = findPath({ ...input, occupied: occupiedBy(before, after.id) });
  return cells === null || cells.length < 2 ? null : { id: after.id, cells };
}

function isTrail(trail: MovementTrail | null): trail is MovementTrail {
  return trail !== null;
}

/** Trajets d'un changement d'état, dans l'ordre des combattants de l'état d'arrivée. */
export function trailsBetween(
  map: AsciiMap | undefined,
  before: readonly Mover[],
  after: readonly Mover[],
): MovementTrail[] {
  if (map === undefined) return [];
  return after.map((mover) => trailFor(map, before, mover)).filter(isTrail);
}

function moversOf(combatants: readonly { id: string; position: Position }[]): Mover[] {
  return combatants.map((combatant) => ({ id: combatant.id, position: combatant.position }));
}

function toMover(combatant: { id: string; position: Position }): Mover {
  return { id: combatant.id, position: combatant.position };
}

function combatMovers(state: CombatState | null): Mover[] {
  return state === null ? [] : [toMover(state.player), toMover(state.enemy)];
}

/** Trajets du 1v1 : le héros et son adversaire, dans l'ordre de `CombatState`. */
export function combatTrails(before: CombatState | null, after: CombatState | null): MovementTrail[] {
  return trailsBetween(after?.map ?? before?.map, combatMovers(before), combatMovers(after));
}

/** Trajets d'une salle : un trajet par combattant qui a bougé. */
export function battleTrails(before: BattleState | null, after: BattleState | null): MovementTrail[] {
  if (before === null || after === null) return [];
  return trailsBetween(after.map ?? before.map, moversOf(before.combatants), moversOf(after.combatants));
}

/** Lot suivant ; un déplacement qui ne bouge personne conserve le lot courant. */
export function nextBatch(previous: TrailBatch, trails: readonly MovementTrail[]): TrailBatch {
  if (trails.length === 0) return previous;
  return { version: previous.version + 1, trails };
}
