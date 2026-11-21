export interface CombatXpInput {
  baseMonsterXp: number;
  wisdom: number;
  levelGapFactor: number;
}

/**
 * Calcule l'XP de combat : base × (1 + sagesse/100) × facteur d'écart de niveau.
 *
 * Garde défensive : le domaine d'entrée est validé en amont (Zod), une sagesse
 * ou un facteur négatif ne produit jamais d'XP négative (`Math.max(0, …)`).
 */
export function computeCombatXp(input: CombatXpInput): number {
  const wisdomFactor = 1 + input.wisdom / 100;
  const rawXp = input.baseMonsterXp * wisdomFactor * input.levelGapFactor;
  return Math.max(0, Math.floor(rawXp));
}
