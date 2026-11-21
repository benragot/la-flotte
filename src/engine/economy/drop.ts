export interface DropChanceInput {
  playerPp: number;
  ppThreshold: number;
  baseDropRate: number;
}

export function isEligibleForDrop(playerPp: number, ppThreshold: number): boolean {
  return playerPp >= ppThreshold;
}

/**
 * Calcule la probabilité de drop : 0 sous le seuil de PP, sinon
 * `min(1, baseDropRate × PP / 100)`.
 *
 * Suppose `baseDropRate` et `ppThreshold` validés en amont (Zod) ; aucune garde
 * négative ici, la formule 1.29 est appliquée telle quelle.
 */
export function computeDropChance(input: DropChanceInput): number {
  if (!isEligibleForDrop(input.playerPp, input.ppThreshold)) return 0;
  return Math.min(1, input.baseDropRate * (input.playerPp / 100));
}
