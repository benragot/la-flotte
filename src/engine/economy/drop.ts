export interface DropChanceInput {
  playerPp: number;
  ppThreshold: number;
  baseDropRate: number;
}

export function isEligibleForDrop(playerPp: number, ppThreshold: number): boolean {
  return playerPp >= ppThreshold;
}

export function computeDropChance(input: DropChanceInput): number {
  if (!isEligibleForDrop(input.playerPp, input.ppThreshold)) return 0;
  return Math.min(1, input.baseDropRate * (input.playerPp / 100));
}
