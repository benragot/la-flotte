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

/**
 * Une table à un seul palier encode un taux fixe : [[capitalPourUnGain, gain]].
 * Les tables multi-paliers encodent des soft caps : [valeurMaxDuPalier, coût].
 */
function flatRateCost(caps: readonly SoftCap[]): number {
  const tier = caps[0];
  if (!tier) return Number.POSITIVE_INFINITY;
  const [ceiling, price] = tier;
  return ceiling ?? price;
}

function isTierReached(threshold: number | null, value: number): boolean {
  return threshold === null || threshold >= value;
}

function costToReach(caps: readonly SoftCap[], value: number): number {
  if (caps.length === 1) return flatRateCost(caps);
  for (const [threshold, cost] of caps) {
    if (isTierReached(threshold, value)) return cost;
  }
  return Number.POSITIVE_INFINITY;
}

function isReachable(state: StatState, caps: readonly SoftCap[]): boolean {
  return costToReach(caps, state.value + 1) <= state.remaining;
}

function spendPoint(state: StatState, caps: readonly SoftCap[], gain: number): StatState {
  const cost = costToReach(caps, state.value + 1);
  return {
    value: state.value + gain,
    gained: state.gained + gain,
    spent: state.spent + cost,
    remaining: state.remaining - cost,
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
  const gain = input.gainPerPoint ?? 1;
  let state = initialState(input);
  while (isReachable(state, caps)) state = spendPoint(state, caps, gain);
  return state;
}
