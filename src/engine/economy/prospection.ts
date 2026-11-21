export interface ProspectionInput {
  basePp: number;
  chance: number;
  bonusPp?: number;
}

function chanceBonus(chance: number): number {
  return Math.floor(Math.max(0, chance) / 10);
}

export function computeProspection(input: ProspectionInput): number {
  const bonusPp = input.bonusPp ?? 0;
  return input.basePp + chanceBonus(input.chance) + bonusPp;
}
