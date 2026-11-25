export interface InitiativeInput {
  strength: number;
  intelligence: number;
  chance: number;
  agility: number;
  currentHp: number;
  maxHp: number;
  bonusInitiative?: number;
  /**
   * Initiative stockée par grade en 1.29 (`MonsterDef.initiative`). Quand elle
   * existe, elle prime sur la formule et ne suit pas les PV restants.
   */
  storedInitiative?: number;
}

function statTotal(input: InitiativeInput): number {
  const primary = input.strength + input.intelligence + input.chance + input.agility;
  return primary + (input.bonusInitiative ?? 0);
}

function hpRatio(input: InitiativeInput): number {
  return input.currentHp / input.maxHp;
}

export function computeInitiative(input: InitiativeInput): number {
  if (input.storedInitiative !== undefined) return input.storedInitiative;
  return Math.floor(statTotal(input) * hpRatio(input));
}
