export interface CritRateInput {
  baseCrit: number;
  bonusCrit: number;
  agility: number;
}

const MIN_CRIT_RATE = 2;
const AGILITY_THRESHOLD = 8;
const EULER_WEIGHT = Math.E * 1.1;

function critDiff(input: CritRateInput): number {
  return input.baseCrit - input.bonusCrit;
}

function scaledCritRate(diff: number, agility: number): number {
  const scaled = (diff * EULER_WEIGHT) / Math.log(agility + 12);
  return Math.max(MIN_CRIT_RATE, Math.floor(scaled));
}

export function computeCritRate(input: CritRateInput): number {
  const diff = critDiff(input);
  if (diff <= MIN_CRIT_RATE) return MIN_CRIT_RATE;
  if (input.agility < AGILITY_THRESHOLD) return diff;
  return scaledCritRate(diff, input.agility);
}
