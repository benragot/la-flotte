import type { HeroTotalStatsInput } from "../engine/hero";
import { combatantFromHero, totalStatsFor } from "../engine/hero";

/** Position neutre : `combatantFromHero` en exige une, les PV n'en dépendent pas. */
const ORIGIN = { x: 0, y: 0 };

/** PV du domaine effectif : ceux que le joueur doit lire partout. */
export interface EffectiveHp {
  hp: number;
  maxHp: number;
}

/**
 * Délègue au moteur : `combatantFromHero` est la seule formule de PV du jeu.
 * Aucun calcul de Vitalité, d'équipement ou de panoplie n'est refait ici.
 */
export function effectiveHp(input: HeroTotalStatsInput): EffectiveHp {
  const stats = totalStatsFor(input);
  const { hp, maxHp } = combatantFromHero({ hero: input.hero, stats, position: ORIGIN, spellIds: [] });
  return { hp, maxHp };
}

/** Ligne « courants / maximum » telle que l'écrit le HUD. */
export function formatEffectiveHp(hp: EffectiveHp): string {
  return `${hp.hp} / ${hp.maxHp}`;
}
