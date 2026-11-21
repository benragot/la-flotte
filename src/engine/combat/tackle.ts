import { clamp } from "./math";

export interface TackleInput {
  fleeAgility: number;
  tackleAgility: number;
}

const TACKLE_OFFSET = 25;
const TACKLE_SPAN = 50;
const TACKLE_SCALE = 300;
const TACKLE_BASE = 100;

function escapeRatio(input: TackleInput): number {
  const numerator = input.fleeAgility + TACKLE_OFFSET;
  const denominator = input.fleeAgility + input.tackleAgility + TACKLE_SPAN;
  return (numerator / denominator) * TACKLE_SCALE - TACKLE_BASE;
}

export function computeTackleEscapePercent(input: TackleInput): number {
  return clamp(escapeRatio(input), 0, 100);
}
