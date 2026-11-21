import type { AsciiMap, Position } from "../grid";
import { isWalkableCell, samePosition } from "../grid";
import type { CombatantState } from "./types";

export interface PushInput {
  map: AsciiMap;
  caster: CombatantState;
  victim: CombatantState;
  cells: number;
}

export interface PushResult {
  position: Position;
  travelled: number;
  blocked: boolean;
}

/**
 * Axe lanceur → cible : on retient l'axe dominant (les diagonales sont
 * ramenées sur une seule dimension, comme en 1.29).
 */
function pushDirection(caster: CombatantState, victim: CombatantState): Position {
  const dx = victim.position.x - caster.position.x;
  const dy = victim.position.y - caster.position.y;
  if (Math.abs(dx) >= Math.abs(dy)) return { x: Math.sign(dx), y: 0 };
  return { x: 0, y: Math.sign(dy) };
}

function isBlocked(input: PushInput, cell: Position): boolean {
  if (!isWalkableCell(input.map, cell)) return true;
  return samePosition(cell, input.caster.position);
}

function nextCell(input: PushInput, from: Position, direction: Position): Position | null {
  const cell = { x: from.x + direction.x, y: from.y + direction.y };
  return isBlocked(input, cell) ? null : cell;
}

function advance(input: PushInput, direction: Position, current: PushResult): PushResult {
  const cell = nextCell(input, current.position, direction);
  if (cell === null) return { ...current, blocked: true };
  return { position: cell, travelled: current.travelled + 1, blocked: false };
}

/**
 * Pousse la cible case par case. `travelled` compte les cases réellement
 * parcourues, `blocked` signale qu'un obstacle a stoppé la poussée.
 */
export function applyPush(input: PushInput): PushResult {
  const direction = pushDirection(input.caster, input.victim);
  let result: PushResult = { position: input.victim.position, travelled: 0, blocked: false };
  for (let step = 0; step < input.cells && !result.blocked; step += 1) {
    result = advance(input, direction, result);
  }
  return result;
}
