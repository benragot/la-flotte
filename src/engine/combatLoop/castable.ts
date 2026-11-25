import type { SpellDef } from "../../schemas/spellSchema";
import type { Position } from "../grid";
import { hasLineOfSight, isWalkableCell, rangeDistance, samePosition } from "../grid";
import { getActiveCombatant, getOpponent } from "./active";
import { allPositions } from "./cells";
import { isSpellImplemented } from "./spellSupport";
import type { CombatantState, CombatState } from "./types";

interface CastCellInput {
  state: CombatState;
  spell: SpellDef;
  caster: CombatantState;
  opponent: CombatantState;
  cell: Position;
}

function inRange(input: CastCellInput): boolean {
  const range = rangeDistance(input.caster.position, input.cell);
  return range >= input.spell.minRange && range <= input.spell.maxRange;
}

function hasSight(input: CastCellInput): boolean {
  if (!input.spell.requiresLos) return true;
  const blockers = [input.opponent.position];
  const from = input.caster.position;
  return hasLineOfSight({ map: input.state.map, from, to: input.cell, blockers });
}

function isDamageCell(input: CastCellInput): boolean {
  return samePosition(input.cell, input.opponent.position) && hasSight(input);
}

function isTeleportCell(input: CastCellInput): boolean {
  if (!isWalkableCell(input.state.map, input.cell)) return false;
  if (samePosition(input.cell, input.opponent.position)) return false;
  return hasSight(input);
}

function isValidCell(input: CastCellInput): boolean {
  if (!inRange(input)) return false;
  return input.spell.kind === "teleport" ? isTeleportCell(input) : isDamageCell(input);
}

/** Cases légales pour un sort donné, vues depuis l'entité active. */
export function getCastableCells(state: CombatState, spellId: string): Position[] {
  const spell = state.spellsById[spellId];
  if (spell === undefined) return [];
  if (!isSpellImplemented(spell)) return [];
  const caster = getActiveCombatant(state);
  const opponent = getOpponent(state);
  const base = { state, spell, caster, opponent };
  return allPositions(state.map).filter((cell) => isValidCell({ ...base, cell }));
}
