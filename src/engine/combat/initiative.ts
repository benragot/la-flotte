export interface InitiativeInput {
  strength: number;
  intelligence: number;
  chance: number;
  agility: number;
  currentHp: number;
  maxHp: number;
  bonusInitiative?: number;
}

function statTotal(input: InitiativeInput): number {
  const primary = input.strength + input.intelligence + input.chance + input.agility;
  return primary + (input.bonusInitiative ?? 0);
}

function hpRatio(input: InitiativeInput): number {
  return input.currentHp / input.maxHp;
}

export function computeInitiative(input: InitiativeInput): number {
  return Math.floor(statTotal(input) * hpRatio(input));
}
