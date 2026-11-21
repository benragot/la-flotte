import type { SoftCap, SoftCaps, StatKey } from "../schemas/classSchema";

export type { StatKey };

export interface SpendStatPointsInput {
  stat: StatKey;
  current: number;
  availablePoints: number;
  softCaps: SoftCaps;
  gainPerPoint?: number;
}

export interface SpendStatPointsResult {
  gained: number;
  spent: number;
  remaining: number;
  value: number;
}

interface StatState {
  value: number;
  gained: number;
  spent: number;
  remaining: number;
}

interface ExchangeTerms {
  capitalPerPoint: number;
  gain: number;
}

/**
 * Convention des tables de `softCaps` :
 * - un seul palier `[[capitalPerPoint, gain]]` : taux d'échange fixe, un point
 *   de caractéristique coûte `capitalPerPoint` et rapporte
 *   `gain * (input.gainPerPoint ?? 1)` ;
 * - plusieurs paliers `[[valeurMaxDuPalier, capitalPerPoint], ..., [null, n]]` :
 *   le coût est celui du palier contenant la valeur visée (`null` = infini) et
 *   le gain vaut `input.gainPerPoint ?? 1`.
 */
function isFlatRate(caps: readonly SoftCap[]): boolean {
  return caps.length === 1;
}

function flatRateTerms(caps: readonly SoftCap[], baseGain: number): ExchangeTerms {
  // Garde runtime explicite : Zod impose min(1), un appel direct peut passer [].
  const [capitalPerPoint, gain = 1] = caps[0] ?? [];
  const cost = capitalPerPoint ?? Number.POSITIVE_INFINITY;
  return { capitalPerPoint: cost, gain: gain * baseGain };
}

function capitalCost(caps: readonly SoftCap[], value: number): number {
  for (const [threshold, capitalPerPoint] of caps) {
    if (threshold === null || threshold >= value) return capitalPerPoint;
  }
  return Number.POSITIVE_INFINITY;
}

function termsFor(caps: readonly SoftCap[], baseGain: number, value: number): ExchangeTerms {
  if (isFlatRate(caps)) return flatRateTerms(caps, baseGain);
  return { capitalPerPoint: capitalCost(caps, value), gain: baseGain };
}

function isReachable(state: StatState, caps: readonly SoftCap[], baseGain: number): boolean {
  return termsFor(caps, baseGain, state.value + 1).capitalPerPoint <= state.remaining;
}

function spendPoint(state: StatState, caps: readonly SoftCap[], baseGain: number): StatState {
  const terms = termsFor(caps, baseGain, state.value + 1);
  return {
    value: state.value + terms.gain,
    gained: state.gained + terms.gain,
    spent: state.spent + terms.capitalPerPoint,
    remaining: state.remaining - terms.capitalPerPoint,
  };
}

function initialState(input: SpendStatPointsInput): StatState {
  return {
    value: input.current,
    gained: 0,
    spent: 0,
    remaining: input.availablePoints,
  };
}

export function spendStatPoints(input: SpendStatPointsInput): SpendStatPointsResult {
  const caps = input.softCaps[input.stat];
  const baseGain = input.gainPerPoint ?? 1;
  let state = initialState(input);
  while (isReachable(state, caps, baseGain)) state = spendPoint(state, caps, baseGain);
  return state;
}
