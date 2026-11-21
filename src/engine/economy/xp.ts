export interface CombatXpInput {
  baseMonsterXp: number;
  wisdom: number;
  levelGapFactor: number;
}

export function computeCombatXp(input: CombatXpInput): number {
  const wisdomFactor = 1 + input.wisdom / 100;
  const rawXp = input.baseMonsterXp * wisdomFactor * input.levelGapFactor;
  return Math.max(0, Math.floor(rawXp));
}
