import type { AsciiMap, Position } from "./asciiMap";
import { getCell, isSightBlocking, samePosition } from "./asciiMap";

export interface LineOfSightInput {
  map: AsciiMap;
  from: Position;
  to: Position;
  blockers?: Position[];
}

function lineLength(from: Position, to: Position): number {
  return Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
}

function lerp(from: number, to: number, step: number): number {
  return from + (to - from) * step;
}

function cellAt(from: Position, to: Position, step: number): Position {
  const x = Math.round(lerp(from.x, to.x, step));
  const y = Math.round(lerp(from.y, to.y, step));
  return { x, y };
}

function dedupe(cells: Position[]): Position[] {
  return cells.reduce<Position[]>((acc, cell) => {
    const last = acc[acc.length - 1];
    const duplicate = last !== undefined && samePosition(last, cell);
    return duplicate ? acc : [...acc, cell];
  }, []);
}

function intermediateCells(from: Position, to: Position): Position[] {
  const steps = lineLength(from, to);
  const cells: Position[] = [];
  for (let step = 1; step < steps; step += 1) {
    cells.push(cellAt(from, to, step / steps));
  }
  return dedupe(cells);
}

function blocksSight(input: LineOfSightInput, position: Position): boolean {
  const cell = getCell(input.map, position);
  if (cell !== undefined && isSightBlocking(cell)) return true;
  return (input.blockers ?? []).some((blocker) => samePosition(blocker, position));
}

type SightStep = readonly [Position, Position];

function sightSteps(cells: Position[]): SightStep[] {
  return cells.slice(1).map((cell, index) => [cells[index] ?? cell, cell] as const);
}

function isDiagonalStep(from: Position, to: Position): boolean {
  return from.x !== to.x && from.y !== to.y;
}

/** Les deux cases orthogonales qui bordent un pas diagonal. */
function cornerCells(from: Position, to: Position): Position[] {
  return [
    { x: to.x, y: from.y },
    { x: from.x, y: to.y },
  ];
}

/** Règle 1.29 des coins : un pas diagonal est coupé si ses deux coins bloquent. */
function cutsSightCorner(input: LineOfSightInput, [from, to]: SightStep): boolean {
  if (!isDiagonalStep(from, to)) return false;
  return cornerCells(from, to).every((corner) => blocksSight(input, corner));
}

export function hasLineOfSight(input: LineOfSightInput): boolean {
  const intermediates = intermediateCells(input.from, input.to);
  if (intermediates.some((cell) => blocksSight(input, cell))) return false;
  const steps = sightSteps([input.from, ...intermediates, input.to]);
  return steps.every((step) => !cutsSightCorner(input, step));
}
