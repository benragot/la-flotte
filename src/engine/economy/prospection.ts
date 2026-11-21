export interface ProspectionInput {
  basePp: number;
  chance: number;
  bonusPp?: number;
}

function chanceBonus(chance: number): number {
  return Math.floor(Math.max(0, chance) / 10);
}

/**
 * Calcule la prospection : PP de base + 1 PP par tranche de 10 de chance.
 *
 * Garde défensive : le domaine d'entrée est validé en amont (Zod), une chance
 * négative n'ajoute jamais de bonus ni de malus (`Math.max(0, chance)`).
 */
export function computeProspection(input: ProspectionInput): number {
  const bonusPp = input.bonusPp ?? 0;
  return input.basePp + chanceBonus(input.chance) + bonusPp;
}
