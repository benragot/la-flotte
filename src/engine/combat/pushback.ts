export interface PushbackInput {
  casterLevel: number;
  roll: number;
  remainingCells: number;
  isSecondaryTarget?: boolean;
}

const BASE_PUSHBACK = 8;
const LEVEL_SCALE = 50;
const SECONDARY_DIVISOR = 2;

function rawPushback(input: PushbackInput): number {
  const levelContribution = (input.roll * input.casterLevel) / LEVEL_SCALE;
  return Math.floor((BASE_PUSHBACK + levelContribution) * input.remainingCells);
}

export function computePushbackDamage(input: PushbackInput): number {
  const damage = rawPushback(input);
  if (input.isSecondaryTarget !== true) return damage;
  return Math.floor(damage / SECONDARY_DIVISOR);
}
