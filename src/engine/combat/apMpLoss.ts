import { clamp } from "./math";

export interface ApMpLossInput {
  casterWisdom: number;
  targetWisdom: number;
  remaining: number;
  max: number;
  bonusDodge?: number;
  bonusRetrait?: number;
}

const MIN_LOSS_CHANCE = 0.1;
const MAX_LOSS_CHANCE = 0.9;
const WISDOM_DIVISOR = 4;
const BALANCE_WEIGHT = 0.5;

function wisdomScore(wisdom: number, bonus: number): number {
  return Math.max(1, Math.floor(wisdom / WISDOM_DIVISOR)) + bonus;
}

function dodgeScore(input: ApMpLossInput): number {
  return wisdomScore(input.targetWisdom, input.bonusDodge ?? 0);
}

function retraitScore(input: ApMpLossInput): number {
  return wisdomScore(input.casterWisdom, input.bonusRetrait ?? 0);
}

function lossRatio(input: ApMpLossInput): number {
  const balance = retraitScore(input) / dodgeScore(input);
  return (BALANCE_WEIGHT * balance * input.remaining) / input.max;
}

export function computeApMpLossChance(input: ApMpLossInput): number {
  return clamp(lossRatio(input), MIN_LOSS_CHANCE, MAX_LOSS_CHANCE);
}
