import { computeCritDenominator } from "../combat";
import type { AttackSpec, CombatantLike, Rng } from "./types";

export interface CriticalInput {
  baseCrit: number;
  bonusCrit?: number;
  agility: number;
}

/**
 * Tirage **exact** du coup critique 1.29 : `rng() * X < 1`, soit une chance de
 * `1/X`. `rng() = 0` passe toujours, `rng() >= 1/X` échoue ; `X = 2` plafonne
 * donc à une chance sur deux. Sans `critRate` déclaré, aucun CC et **aucun dé
 * consommé** : pas de donnée = pas de coup critique.
 */
export function rollsCritical(attacker: CombatantLike, attack: AttackSpec, rng: Rng): boolean {
  if (attack.critRate === undefined) return false;
  const input = { baseCrit: attack.critRate, bonusCrit: attack.bonusCrit ?? 0, agility: attacker.stats.agility };
  return rng() * computeCritDenominator(input) < 1;
}
