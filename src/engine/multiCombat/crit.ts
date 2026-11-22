import { computeCritRate } from "../combat";
import type { AttackSpec, CombatantLike, Rng } from "./types";

const CRIT_ALWAYS = 100;
const PERCENT = 100;

export interface CriticalInput {
  baseCrit: number;
  bonusCrit?: number;
  agility: number;
}

function critInput(input: CriticalInput): { baseCrit: number; bonusCrit: number; agility: number } {
  return { baseCrit: input.baseCrit, bonusCrit: input.bonusCrit ?? 0, agility: input.agility };
}

/** Taux de coup critique ≥ 100 % : coup critique garanti, sans jet. */
export function isCritical(input: CriticalInput): boolean {
  return computeCritRate(critInput(input)) >= CRIT_ALWAYS;
}

/**
 * Critique garanti au-delà de 100 %, sinon un tirage unique
 * `rng() × 100 < taux`. Aucun `rng` n'est consommé quand le critique est
 * garanti, pour garder les séquences de jets déterministes.
 */
export function rollsCritical(attacker: CombatantLike, attack: AttackSpec, rng: Rng): boolean {
  const input = { baseCrit: attack.baseCrit, bonusCrit: attack.bonusCrit ?? 0, agility: attacker.stats.agility };
  if (isCritical(input)) return true;
  return rng() * PERCENT < computeCritRate(critInput(input));
}
